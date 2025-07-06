import { SignInView } from "@/modules/auth/ui/views/sign-in-view";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';

const Page = async () => {

  const session = await auth.api.getSession({
      headers: headers(),
    });
  
    if(!!session){
      redirect("/");
    }
  

  return <SignInView />
};

export default Page;