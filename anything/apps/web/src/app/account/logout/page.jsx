import { useEffect } from "react";
import useAuth from "@/utils/useAuth";

function MainComponent() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut({ callbackUrl: "/account/signin", redirect: true });
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 text-white">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent mx-auto"></div>
        <p className="text-zinc-400 font-medium">Signing you out...</p>
      </div>
    </div>
  );
}

export default MainComponent;
