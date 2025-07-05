"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { MeetingIdViewHeader } from "../components/meeting-id-view-header";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { UpdateMeetingDialog } from "../components/update-meeting-dialog";
import { useState } from "react";
import { UpcomingState } from "../components/upcoming-state";
import { ActiveState } from "../components/active-state";
import { CancelledState } from "../components/cancelled-state";
import { ProcessingState } from "../components/processing-state";

interface Props {
    meetingId: string;
};

export const MeetingIdView = ({meetingId}: Props) => {

    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const router = useRouter();

    const [RemoveConfirmation, confirmRemove] = useConfirm(
        "Are you sure you want to remove this meeting?",
        `This action will permanently remove the meeting from your account. This cannot be undone.`,
    )

    const {data} = useSuspenseQuery(trpc.meetings.getOne.queryOptions({id: meetingId}));

    const removeMeeting = useMutation(trpc.meetings.remove.mutationOptions({
        onSuccess: async () => {
            await queryClient.invalidateQueries(trpc.meetings.getMany.queryOptions({}));
            router.push("/meetings");
        },
        onError: (error) => {
            toast.error(error.message);
        },
    }));

    const handleRemoveMeeting = async () => {
        const ok = await confirmRemove();
        if(!ok) return;
        if (ok) {
            removeMeeting.mutate({id: meetingId});
        }
    }

    const [updateMeetingDialogOpen, setUpdateMeetingDialogOpen] = useState(false);

    const isActive = data.status === "active";
    const isUpcoming = data.status === "upcoming";
    const isCancelled = data.status === "cancelled";
    const isCompleted = data.status === "completed";
    const isProcessing = data.status === "processing";

    return (
      <>
      <RemoveConfirmation />
      <UpdateMeetingDialog open={updateMeetingDialogOpen} onOpenChange={setUpdateMeetingDialogOpen} initialValues={data} />
        <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-4">
          <MeetingIdViewHeader
            meetingId={meetingId}
            meetingName={data.name}
            onEdit={() => {setUpdateMeetingDialogOpen(true)}}
            onRemove={handleRemoveMeeting}
          />
          {isCancelled && (<CancelledState />)}
          {isCompleted && <div>Completed</div>}
          {isProcessing && <ProcessingState />}
          {isUpcoming && ( <UpcomingState meetingId={meetingId} onCancelMeeting={() => {}} isCancelling={false} /> )}
          {isActive && ( <ActiveState meetingId={meetingId} /> )}
        </div>
      </>
    );
}

export const MeetingIdViewLoading = () => {
    return (
        <LoadingState title="Loading Meeting" description="This might take a few seconds" />
    )
}

export const MeetingIdViewError = () => {
    return (
        <ErrorState title="Error loading meeting" description="Something went wrong" />
    )
}