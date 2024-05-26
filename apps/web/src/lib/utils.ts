import { toast } from "sonner";
import { domToPng } from "modern-screenshot";

export const onSaveImage = (id: string) => {
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
    {
      loading: "Saving...",
      success: "Download ready",
      error: "An error occured!",
    },
  );
};

export const formatError = (err: string) => {
  return err.replace("[GraphQL] ", "");
};
