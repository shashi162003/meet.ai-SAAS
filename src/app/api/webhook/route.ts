import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import {
  CallSessionParticipantLeftEvent,
  CallSessionStartedEvent,
} from "@stream-io/node-sdk";
import { and, eq, not } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function verifySignatureWithSDK(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature");
  const apiKey = req.headers.get("x-api-key");

  if (!signature || !apiKey) {
    return NextResponse.json(
      { error: "Missing signature or api key" },
      { status: 400 }
    );
  }

  const body = await req.text();

  if (!verifySignatureWithSDK(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (payload as Record<string, unknown>)?.type;

  if (eventType === "call.session_started") {
    const event = payload as CallSessionStartedEvent;
    const meetingId = event.call.custom?.meetingId;

    if (!meetingId) {
      return NextResponse.json(
        { error: "Missing meeting id" },
        { status: 400 }
      );
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          not(eq(meetings.status, "completed")),
          not(eq(meetings.status, "active")),
          not(eq(meetings.status, "cancelled")),
          not(eq(meetings.status, "processing"))
        )
      );

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    await db
      .update(meetings)
      .set({
        status: "active",
        startedAt: new Date(),
      })
      .where(eq(meetings.id, existingMeeting.id));

    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingMeeting.agentId));

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const call = streamVideo.video.call("default", meetingId);

    try {
      // First, make the agent join the call
      await call.join({
        create: false,
        data: {
          members: [
            {
              user_id: existingAgent.id,
              role: "user",
            },
          ],
        },
      });

      // Then connect OpenAI with proper configuration
      const realtimeClient = await streamVideo.video.connectOpenAi({
        call,
        openAiApiKey: process.env.OPENAI_API_KEY!,
        agentUserId: existingAgent.id,
      });

      // Update session with agent instructions
      realtimeClient.updateSession({
        instructions: existingAgent.instructions,
        voice: "alloy", // Set a default voice
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1",
        },
      });

      console.log(`Agent ${existingAgent.name} successfully joined call ${meetingId}`);
    } catch (error) {
      console.error("Failed to connect agent to call:", error);
      return NextResponse.json(
        { error: "Failed to initialize AI agent" },
        { status: 500 }
      );
    }
  } else if (eventType === "call.session_participant_left") {
    const event = payload as CallSessionParticipantLeftEvent;
    const meetingId = event.call_cid.split(":")[1];

    if (!meetingId) {
      return NextResponse.json(
        { error: "Missing meeting id" },
        { status: 400 }
      );
    }

    // Check if there are any human participants left
    const call = streamVideo.video.call("default", meetingId);
    try {
      const callState = await call.get();
      const humanParticipants = callState.call.session?.participants?.filter(
        (p) => !p.user_id?.startsWith("agent_") && p.user_id !== event.user.id
      );

      // Only end the call if no human participants are left
      if (!humanParticipants || humanParticipants.length === 0) {
        await call.end();
        
        // Update meeting status
        await db
          .update(meetings)
          .set({
            status: "processing",
            endedAt: new Date(),
          })
          .where(eq(meetings.id, meetingId));
      }
    } catch (error) {
      console.error("Failed to handle participant left:", error);
      return NextResponse.json(
        { error: "Failed to handle participant leaving" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ status: "ok" });
}