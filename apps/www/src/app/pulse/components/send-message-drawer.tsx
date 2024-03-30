import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@umamin/ui/components/drawer";

import { ChatBox } from "@/app/components/chatbox";
import { Icons } from "@/app/components/utilities/icons";

export function SendMessageDrawer() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button type='button'>
          <Icons.chat />
        </button>
      </DrawerTrigger>
      <DrawerContent className=''>
        <div className='py-10 grid place-items-center container w-full min-w-80'>
          <ChatBox />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
