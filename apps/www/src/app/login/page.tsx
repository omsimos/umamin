"use client";

import { Icons } from "../components/utilities/icons";
import { Button } from "@umamin/ui/components/button";
import {
  Card,
  CardTitle,
  CardFooter,
  CardHeader,
  CardDescription,
} from "@umamin/ui/components/card";

export default function Login() {
  return (
    <section className='max-w-lg container'>
      <Card className='space-y-5'>
        <CardHeader className='space-y-1'>
          <CardTitle className='text-2xl flex justify-between items-center'>
            <p>Login to proceed</p>
          </CardTitle>
          <CardDescription>
            The ultimate platform for anonymous messages!
          </CardDescription>
        </CardHeader>

        <CardFooter className='flex flex-col items-start'>
          <Button className='w-full font-medium'>Login with Google</Button>
        </CardFooter>
      </Card>
    </section>
  );
}
