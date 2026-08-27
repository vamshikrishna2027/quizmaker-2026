import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LOGIN_PATH, REGISTER_PATH } from "@/lib/auth/paths";

export default function Home() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Quiz Maker</CardTitle>
            <CardDescription>
              Sprint 1: teacher registration, login, and logout.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button nativeButton={false} render={<Link href={LOGIN_PATH} />}>
              Sign in
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={REGISTER_PATH} />}
            >
              Create account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
