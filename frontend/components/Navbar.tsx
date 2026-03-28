"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { DiCompass } from "react-icons/di";
import { MdContactSupport, MdOutlineContactSupport } from "react-icons/md";
import { Bookmark, Search } from "lucide-react";
import { RiBookOpenFill, RiBookOpenLine } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import { ModeToggle } from "@/components/mode-toggle";
// UI imports
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSession, logout } from "@/state/session/sessionSlice";
import type { Dispatch, RootState } from "@/state/store";

export default function Navbar() {
  const pathname = usePathname();
  const dispatch = useDispatch<Dispatch>();
  const user = useSelector((s: RootState) => s.user);

  // Check session on mount to handle page refresh
  useEffect(() => {
    dispatch(getSession());
  }, [dispatch]);

  const handleLogout = () => {
    dispatch(logout());
  };

  const getInitials = (name: string, email: string) => {
    if (name?.trim()) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() || "U";
  };

  return (
    <div className="flex flex-col items-start h-full max-h-screen gap-6 p-2.5 w-full border-r bg-primary text-primary-foreground">
      <div className="self-center pt-2">
        <Link href="/">
          <Button
            variant="nav"
            className="w-full justify-start hover:bg-primary"
          >
            <DiCompass className="text-white !h-12 !w-12" />
            <h1 className="text-xl">Course Community</h1>
          </Button>
        </Link>
      </div>

      <ul className="space-y-2 w-full mt-10">
        <li>
          <Link href="/search">
            <Button variant="nav" className="w-full justify-start">
              <Search
                className="text-white !h-4 !w-4 shrink-0"
                strokeWidth={pathname === "/search" ? 2.75 : 2}
                aria-hidden
              />
              <h1 className="text-md">Explore</h1>
            </Button>
          </Link>
        </li>
        <li>
          <Link href="/favorites">
            <Button variant="nav" className="w-full justify-start">
              <Bookmark
                className={
                  pathname === "/favorites"
                    ? "text-white !h-4 !w-4 shrink-0 fill-white"
                    : "text-white !h-4 !w-4 shrink-0"
                }
                aria-hidden
              />
              <h1 className="text-md">Saved courses</h1>
            </Button>
          </Link>
        </li>
        {/*
        <li>
          <Link href="/reviews">
            <Button variant="nav" className="w-full justify-start">
              {pathname === "/reviews" ? (
                <RiStarFill className="text-white !w-4 !h-4" />
              ) : (
                <RiStarLine className="text-white !w-4 !h-4" />
              )}
              <h1 className="text-md">My Reviews</h1>
            </Button>
          </Link>
        </li>
        */}
      </ul>

      {/* The menu just above the profile card */}
      <ul className="space-y-1 w-full mt-auto">
        <li>
          <Link href="/about">
            <Button variant="nav" className="w-full justify-start">
              {pathname === "/about" ? (
                <RiBookOpenFill className="text-white !w-4 !h-4" />
              ) : (
                <RiBookOpenLine className="text-white !w-4 !h-4" />
              )}
              <h1 className="text-md ml-2">About</h1>
            </Button>
          </Link>
        </li>
        <li>
          <Link href="/contact">
            <Button variant="nav" className="w-full justify-start">
              {pathname === "/contact" ? (
                <MdContactSupport className="text-white !w-4 !h-4" />
              ) : (
                <MdOutlineContactSupport className="text-white !w-4 !h-4" />
              )}
              <h1 className="text-md ml-2">Contact</h1>
            </Button>
          </Link>
        </li>
      </ul>

      {/* PROFILE CARD */}
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full mb-10 h-auto rounded-md text-sm font-medium transition-all gap-2 py-2 pl-2 pr-2 justify-start whitespace-normal cursor-pointer flex items-center group hover:bg-primary-light">
          {user.profilePicture ? (
            <img
              src={user.profilePicture}
              alt="Profile"
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-white font-semibold">
              {getInitials(user.name, user.email)}
            </div>
          )}
          <span className="transition-all group-hover:font-bold">
            {user.name?.trim() ||
              user.email?.split("@")[0] ||
              "Loading user..."}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <Link href="/profile" passHref>
            <DropdownMenuItem
              asChild
              className={
                pathname === "/profile"
                  ? "bg-primary text-white font-semibold"
                  : ""
              }
            >
              <span>Profile</span>
            </DropdownMenuItem>
          </Link>
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-600 cursor-pointer"
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="w-full flex justify-end pr-2 pb-4">
        <ModeToggle />
      </div>
    </div>
  );
}
