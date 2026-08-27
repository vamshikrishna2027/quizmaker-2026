import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LOGOUT_PATH } from "@/lib/auth/paths";

export function McqStubPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>MCQ workspace</CardTitle>
            <CardDescription>
              You are signed in. MCQ creation and test bank features will arrive
              in a future sprint.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This page is a placeholder landing page after registration or
              login.
            </p>
            <form action={LOGOUT_PATH} method="POST">
              <Button type="submit" variant="outline">
                Log out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
