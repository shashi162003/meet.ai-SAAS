import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { meetingId } = await req.json();
  if (!meetingId) {
    return NextResponse.json({ error: "Missing meeting id" }, { status: 400 });
  }

  const [existingMeeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId));

  if (!existingMeeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, existingMeeting.agentId));

  if (!existingAgent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const call = streamVideo.video.call("default", meetingId);

  try {
    const realtimeClient = await streamVideo.video.connectOpenAi({
      call,
      openAiApiKey: process.env.OPENAI_API_KEY!,
      agentUserId: existingAgent.id,
    });
    realtimeClient.updateSession({
      instructions: existingAgent.instructions,
    });
  } catch (error) {
    console.error("Failed to connect OpenAI agent:", error);
    return NextResponse.json(
      { error: "Failed to initialize AI agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "ok" });
}
