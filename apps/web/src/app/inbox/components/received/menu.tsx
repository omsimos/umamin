"use client";

import { toast } from "sonner";
import { useCallback } from "react";
import { domToPng } from "modern-screenshot";
import { Menu } from "@/app/components/menu";

export function ReceivedMessageMenu({ id }: { id: string }) {
  const onSaveImage = useCallback(() => {
    const target = document.querySelector(`#${id}`);

    if (!target) {
      toast.error("An error occured");
      return;
    }

    toast.promise(
      domToPng(target, {
        quality: 1,
        scale: 4,
        backgroundColor: "#111113",
        style: {
          scale: "0.9",
          display: "grid",
          placeItems: "center",

        },
      })
        .then((dataUrl) => {
          const link = document.createElement("a");
          link.download = `umamin-${id}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.log(err);
        }),
      { loading: "Saving...", success: "Download ready", error: "Error!" },
    );
  }, [id]);

  const menuItems = [
    {
      title: "Save Image",
      onClick: onSaveImage,
    },
    {
      title: "Delete",
      onClick: () => {
        toast.error("Not implemented yet");
      },
      className: "text-red-500",
    },
  ];

  return <Menu menuItems={menuItems} />;
}
