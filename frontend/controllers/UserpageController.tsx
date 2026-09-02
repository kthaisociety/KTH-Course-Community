"use client";

import { useSessionData } from "@/hooks/sessionHooks";
import { useFavorites } from "@/hooks/userHooks";
import UserView from "@/views/UserView";

export default function UserpageController() {
  const { user, userId, isPending } = useSessionData();
  const { favorites } = useFavorites();

  if (isPending) {
    return <div>Loading...</div>;
  }
  return (
    <UserView name={user?.name ?? ""} favorites={favorites} userId={userId} />
  );
}
