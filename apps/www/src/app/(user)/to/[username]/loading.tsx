import { Skeleton } from "@umamin/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="mt-36 pb-24 grid place-items-center container">
      <div className="w-full max-w-2xl relative">
        <div className="rounded-b-md w-full h-[440px] opacity-10 bg-muted" />

        <div className="h-[440px] w-full absolute top-0 left-0 flex flex-col">
          <div className="w-full flex justify-between py-8 px-5 sm:px-7">
            <div className="items-center flex gap-2">
              <Skeleton className="rounded-b-md w-[60px] h-[10px]" />
              <Skeleton className="rounded-b-md size-4" />
            </div>
            <Skeleton className="rounded-b-md w-[60px] h-[10px]" />
          </div>

          <Skeleton className="w-full h-[2px]" />

          <div className="flex flex-col justify-between h-full py-10 px-5 sm:px-7">
            <div className="flex gap-2">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="w-2/3 h-10" />
            </div>

            <div className="w-full flex gap-2 items-center mx-auto max-w-lg ">
              <Skeleton className="w-full h-9" />
              <Skeleton className="size-10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
