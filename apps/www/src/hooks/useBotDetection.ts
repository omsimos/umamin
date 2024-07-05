import { useEffect } from "react";
import { load } from "@fingerprintjs/botd";
import { useRouter } from "next/navigation";

const useBotDetection = () => {
  const router = useRouter();

  useEffect(() => {
    const detectBot = async () => {
      try {
        const botd = await load({ monitoring: false });
        const result = botd.detect();

        if (result.bot) {
          router.push("/blocked");
        }
      } catch (error) {
        console.error("Bot detection error:", error);
      }
    };

    detectBot();
  }, [router]);
};

export default useBotDetection;
