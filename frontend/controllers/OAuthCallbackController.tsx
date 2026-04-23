"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import ThirdParty from "supertokens-auth-react/recipe/thirdparty";
import { initST } from "@/lib/supertokens.client";
import type { Dispatch } from "@/state/store";
import { clearUser } from "@/state/user/userSlice";
import { getUser } from "@/state/user/userThunk";
import OAuthCallbackView from "@/views/OAuthCallbackView";

export default function OAuthCallbackController() {
  const router = useRouter();
  const dispatch = useDispatch<Dispatch>();
  useEffect(() => {
    initST();
    (async () => {
      try {
        const result = await ThirdParty.signInAndUp();
        if (result.status === "OK") {
          await ThirdParty.getStateAndOtherInfoFromStorage();
          const userResult = await dispatch(getUser());
          if (!userResult?.success) {
            dispatch(clearUser());
            router.replace("/auth?error=user");
            return;
          }
          router.replace("/search");
          return;
        }
        // Todo add a toaster to show the error to the user
        dispatch(clearUser());
        router.replace("/auth?error=oauth");
      } catch (_error) {
        dispatch(clearUser());
        router.replace("/auth?error=oauth");
      }
    })().catch(() => {
      dispatch(clearUser());
      router.replace("/auth?error=oauth");
    });
  }, [router, dispatch]);

  return <OAuthCallbackView />;
}
