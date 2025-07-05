"use client";

import { ErrorState } from "@/components/error-state";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { LoadingState } from "@/components/loading-state";
import { AgentIdViewHeader } from "@/modules/agents/ui/components/agent-id-view-header";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { VideoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { useState } from "react";
import { UpdateAgentDialog } from "@/modules/agents/ui/components/update-agent-dialog";

interface Props {
    agentId: string;
}

export const AgentIdView = ({ agentId }: Props) => {

    const [updateAgentDialogOpen, setUpdateAgentDialogOpen] = useState(false);

    const router = useRouter();
    const queryClient = useQueryClient();

    const trpc = useTRPC();
    const {data} = useSuspenseQuery(trpc.agents.getOne.queryOptions({id: agentId}));

    const removeAgent = useMutation(
      trpc.agents.remove.mutationOptions({
        onSuccess: async () => {
          await queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({}));
          router.push("/agents");
        },
        onError: (error) => {
            toast.error(error.message);
        },
      })
    )

    const [RemoveConfirmation, confirmRemove] = useConfirm(
        "Are you sure you want to remove this agent?",
        `This action will permanently remove the agent ${data.name} from your account and delete ${data.meetingCount} associated meetings. This cannot be undone.`,
    )

    const handleRemoveAgent = async () => {
        const ok = await confirmRemove();

        if(!ok){
            return;
        }

        if (ok) {
            removeAgent.mutateAsync({id: agentId});
        }
    }

    return (
      <>
      <RemoveConfirmation />
      <UpdateAgentDialog open={updateAgentDialogOpen} onOpenChange={setUpdateAgentDialogOpen} intialValues={data} />
        <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-4">
          <AgentIdViewHeader
            agentId={agentId}
            agentName={data.name}
            onEdit={() => {setUpdateAgentDialogOpen(true)}}
            onRemove={handleRemoveAgent}
          />
          <div className="bg-white rounded-lg border p-4">
            <div className="px-4 py-5 gap-y-5 flex flex-col col-span-5">
              <div className="flex items-center gap-x-3">
                <GeneratedAvatar
                  seed={data.name}
                  variant="botttsNeutral"
                  className="size-10"
                />
                <h2 className="text-2xl font-medium">{data.name}</h2>
              </div>
              <Badge
                variant="outline"
                className="flex items-center gap-x-2 [&>svg]:size-4"
              >
                <VideoIcon className="text-blue-700" />
                {data.meetingCount}{" "}
                {data.meetingCount === 1 ? "meeting" : "meetings"}
              </Badge>
              <div className="flex flex-col gap-y-4">
                <p className="text-lg font-medium">Instructions</p>
                <p className="text-neutral-800">{data.instructions}</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
};

export const AgentIdViewLoading = () => {
    return (
        <LoadingState title="Loading agent" description="This might take a few seconds" />
    )
}

export const AgentIdViewError = () => {
    return (
        <ErrorState title="Error loading agent" description="Something went wrong" />
    )
}