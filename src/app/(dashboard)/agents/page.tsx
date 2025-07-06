import { getQueryClient, trpc } from "@/trpc/server";
import { AgentsView, AgentsViewError, AgentsViewLoading } from "./ui/views/agents-view";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { AgentListHeader } from "@/modules/agents/ui/components/agents-list-header";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs";
import { loadSearchParams } from "@/modules/agents/params";

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<SearchParams>;
}

const Page = async ({ searchParams }: Props) => {

  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({
      headers: headers(),
    });
  
    if(!session){
      redirect("/sign-in");
    }

    const queryClient = getQueryClient();
    void queryClient.prefetchQuery(trpc.agents.getMany.queryOptions({
      ...filters,
    }));

    return (
      <>
      <AgentListHeader />
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<AgentsViewLoading />}>
            <ErrorBoundary fallback={<AgentsViewError />}>
              <AgentsView />
            </ErrorBoundary>
          </Suspense>
        </HydrationBoundary>
      </>
    );
}

export default Page;