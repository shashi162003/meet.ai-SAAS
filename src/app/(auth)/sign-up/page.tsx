import { SignUpView } from "@/modules/auth/ui/views/sign-up-view";
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
  
  return <SignUpView />
};

export default Page;