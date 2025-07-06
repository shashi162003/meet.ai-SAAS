import { auth } from "@/lib/auth";
import { HomeView } from "@/modules/home/ui/views/home-view";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';

const Page = async () => {

  const session = await auth.api.getSession({
    headers: headers(),
  });

  if(!session){
    redirect("/sign-in");
  }

  return <HomeView />
}

export default Page;