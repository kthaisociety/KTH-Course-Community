"use client";

import { motion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon } from "@/components/icon";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { useSessionData } from "@/features/auth";
import { Auth } from "@/features/auth/components/auth";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
  visibleSub: {
    opacity: 1,
    transition: {
      delayChildren: 1,
      staggerChildren: 0.05,
    },
  },
};
const childVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      damping: 10,
      stiffness: 50,
    },
  },
  visibleSub: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      damping: 10,
      stiffness: 50,
    },
  },
};

const titleText =
  "Explore, find and express your thoughts with Course Community!";
const subTitleText =
  "What every KTH student has thought of at least once, and it is finally here! A forum for reviewing and exploring all KTH courses! ";

export function Landing() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const { isAuthenticated, isPending } = useSessionData();

  function onSubmit() {
    if (isAuthenticated) {
      router.push("/search");
    } else {
      setIsLoggingIn(true);
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (isLoggingIn) {
    return <Auth />;
  }

  const titleWords = titleText.split(" ");
  const subTitleWords = subTitleText.split(" ");

  return (
    <div>
      <Topbar />
      <motion.div
        className="flex flex-col w-full justify-left p-40 text-secondary"
        style={{
          backgroundImage: 'url("compass-pixabay.png")',
          backgroundSize: "75%",
          backgroundPosition: "right center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-transparent" />

        <div className="relative z-10 w-3/4 2xl:w-1/3 break-words">
          <motion.h1
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-7xl font-extrabold tracking-wide leading-snug md:text-6xl"
          >
            {titleWords.map((word, id) => {
              const key = `${word}-${id}`;
              return (
                <motion.span
                  variants={childVariants}
                  key={key}
                  style={{ display: "inline-block" }}
                >
                  {word}
                  {"\u00A0"}
                </motion.span>
              );
            })}
          </motion.h1>
          <motion.h2
            variants={containerVariants}
            initial="hidden"
            animate="visibleSub"
            transition={{ delay: 2 }}
            className="text-xl pt-8 font-serif"
          >
            {subTitleWords.map((word, id) => {
              const key = `${word}-${id}`;
              return (
                <motion.span
                  variants={childVariants}
                  key={key}
                  style={{ display: "inline-block" }}
                >
                  {word}
                  {"\u00A0"}
                </motion.span>
              );
            })}
          </motion.h2>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            type: "tween",
            duration: 0.3,
            ease: "easeOut",
            delay: 3.5,
          }}
          className="flex relative z-10 w-full pt-8"
        >
          <Button
            asChild
            size="lg"
            variant="default"
            className="h-15 text-lg px-9"
            onClick={onSubmit}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative inline-block px-8 py-4 font-bold text-white rounded-lg overflow-hidden cursor-pointer"
            >
              <span className="absolute inset-0 bg-gradient-to-l from-primary to-secondary bg-[length:125%_100%] bg-[100%_10%] transition-all duration-500 ease-out hover:bg-[length:200%_100%] hover:bg-[0%_0%]" />
              <span className="relative z-10 flex items-center gap-2">
                Get started
                <ArrowRightIcon />
              </span>
            </motion.button>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
