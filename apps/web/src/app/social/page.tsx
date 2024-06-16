import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import {
  BadgeCheck,
  EllipsisVertical,
  Heart,
  MessageCircle,
  MessageSquareShare,
  ScanFace,
  Share2,
} from "lucide-react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

export default function Social() {
  return (
    <main className="flex items-center flex-col pt-36 container">
      <Link
        className="flex items-center space-x-2 rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 mb-8 text-sm px-4 py-2"
        href="https://v1.umamin.link"
        target="_blank"
      >
        <p className="text-muted-foreground">Coming Soon!</p>
      </Link>

      <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent tracking-tighter text-center">
        Umamin Social
      </h1>

      <p className="text-muted-foreground mt-2 text-center md:text-xl max-w-2xl">
        An open-source social platform for the Umamin community.
      </p>

      <section className="pt-24 w-full max-w-xl">
        <div className="flex space-x-1">
          <Avatar className="relative top-1">
            <AvatarImage
              className="rounded-full"
              src="https://lh3.googleusercontent.com/a/ACg8ocK4CtuGuDZlPy9H_DMb3EQIue9Hrd5bqYcMZOY-Xb8LcuyqsBI=s96-c"
              alt="User avatar"
            />
            <AvatarFallback className="text-xs">
              <ScanFace />
            </AvatarFallback>
          </Avatar>

          <div className="pl-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Link
                  href="/user/umamin"
                  className="font-semibold hover:underline"
                >
                  umamin
                </Link>
                <BadgeCheck className="w-4 h-4 text-pink-500" />
              </div>

              <p className="text-muted-foreground text-xs">
                {formatDistanceToNow(fromUnixTime(1718343208), {
                  addSuffix: true,
                })}
              </p>
            </div>

            <p className="text-sm mt-1">
              Introducing our next generation platform for anonymous messages.
            </p>

            <div className="flex items-center space-x-2 text-muted-foreground mt-4">
              <Heart className="h-5 w-5" />
              <MessageCircle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
