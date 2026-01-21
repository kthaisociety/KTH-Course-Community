"use client";

import Link from "next/link";
import { DiCompass } from "react-icons/di";
import { Button } from "./ui/button";

export default function Topbar() {
  return (
    <div className="flex w-full fixed z-50 p-5 bg-primary items-center justify-between">
      <Link href="/">
        <Button variant="nav" className="w-full justify-start hover:bg-primary">
          <DiCompass className="text-white !w-9 !h-9" />
          <h1 className="font-bold text-3xl text-white">Course Community</h1>
        </Button>
      </Link>
      <nav>
        <ul className="flex justify-end gap-10">
          <li>
            <Link
              href="/about"
              className="p-3 text-primary-foreground hover:underline"
            >
              About
            </Link>
          </li>
          <li>
            <Link
              href="/contact"
              className="p-3 text-primary-foreground hover:underline"
            >
              Contact
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
