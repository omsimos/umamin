"use client";

import { cn } from "@umamin/ui/lib/utils";
import { BadgeCheck, ScanFace, Lock } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@umamin/ui/components/avatar";
import { AnimatedShinyText } from "@umamin/ui/components/animated-shiny-text";

import GridPattern from "@umamin/ui/components/grid-pattern";
import ShineBorder from "@umamin/ui/components/shine-border";
import { Card, CardHeader } from "@umamin/ui/components/card";

export function Demo() {
  return (
    <div className="relative w-full grid place-items-center py-10">
      <GridPattern
        className={cn(
          "xl:[mask-image:radial-gradient(circle_at_center,white,transparent_60%)] [mask-image:radial-gradient(circle_at_center,white,transparent)] md:[mask-image:radial-gradient(circle_at_center,white,transparent_80%)] ",
          "border dark:border-foreground/10 border-foreground/20 z-[-1]",
        )}
      />

      <ShineBorder color="#a9a9b1" className="w-full max-w-xl">
        <Card className="border flex flex-col">
          <CardHeader className="bg-background border-b w-full item-center rounded-t-lg flex justify-between flex-row">
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground">To:</span>
              <p className="font-semibold text-sm">Umamin Official</p>
              <BadgeCheck className="w-4 h-4 text-pink-500" />
            </div>

            <span className="font-semibold text-muted-foreground pb-2">
              umamin
            </span>
          </CardHeader>

          <div className="flex flex-col px-5 sm:px-7 pt-10 pb-8 min-h-[270px] h-full">
            <div className="flex gap-2 items-center">
              <Avatar>
                <AvatarImage
                  className="rounded-full"
                  src="https://lh3.googleusercontent.com/a/ACg8ocK4CtuGuDZlPy9H_DMb3EQIue9Hrd5bqYcMZOY-Xb8LcuyqsBI=s96-c"
                />
                <AvatarFallback>
                  <ScanFace />
                </AvatarFallback>
              </Avatar>
              <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-muted min-w-0 break-words">
                Send me an anonymous message!
              </div>
            </div>

            <div className="sm:max-w-[70%] max-w-[85%] bg-muted rounded-lg px-3 py-2 self-end mt-8">
              <AnimatedShinyText className="min-w-0 break-all text-right">
                SVHPJZ57QbFTnt3CqdpV+JPg6GCgPh/MbCXA/TsXRAWYEwQN2Xwtcl4=
              </AnimatedShinyText>
            </div>
            <span className="text-muted-foreground mt-2 text-sm text-right flex self-end gap-1 items-center">
              <Lock className="size-3" />
              Advanced Encryption Standard
              <Lock className="size-3" />
            </span>
          </div>
        </Card>
      </ShineBorder>
    </div>
  );
}
