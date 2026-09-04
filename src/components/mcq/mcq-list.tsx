"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EllipsisVertical } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LOGOUT_PATH } from "@/lib/auth/paths";
import { submitAuthRequest } from "@/lib/auth/submit-auth";
import { readActorUserId } from "@/lib/mcq/actor";
import {
  MCQS_API_PATH,
  MCQS_NEW_PATH,
  mcqApiPath,
  mcqEditPath,
  mcqPreviewPath,
} from "@/lib/mcq/paths";
import type { McqListItem } from "@/lib/services/mcq-service";

export function McqList() {
  const [mcqs, setMcqs] = useState<McqListItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<McqListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(MCQS_API_PATH)
      .then(async (response) => {
        if (!response.ok) {
          return { mcqs: [] as McqListItem[] };
        }
        return (await response.json()) as { mcqs?: McqListItem[] };
      })
      .then((data) => {
        if (!cancelled) {
          setMcqs(data.mcqs ?? []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    const response = await fetch(mcqApiPath(pendingDelete.id), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorUserId: readActorUserId() ?? "" }),
    });
    setIsDeleting(false);

    if (response.ok) {
      setMcqs((current) =>
        current.filter((item) => item.id !== pendingDelete.id),
      );
      setPendingDelete(null);
    }
  }

  return (
    <div className="flex min-h-svh w-full flex-col gap-6 p-6 md:p-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-medium">Questions</h1>
        <div className="flex items-center gap-2">
          <Link href={MCQS_NEW_PATH} className={buttonVariants()}>
            Create question
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void submitAuthRequest(LOGOUT_PATH, {});
            }}
          >
            Log out
          </Button>
        </div>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Question</TableHead>
            <TableHead className="w-16">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mcqs.map((mcq) => (
            <TableRow key={mcq.id}>
              <TableCell className="whitespace-normal">{mcq.name}</TableCell>
              <TableCell className="whitespace-normal">{mcq.question}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Actions"
                      />
                    }
                  >
                    <EllipsisVertical />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLinkItem href={mcqEditPath(mcq.id)}>
                      Edit
                    </DropdownMenuLinkItem>
                    <DropdownMenuLinkItem href={mcqPreviewPath(mcq.id)}>
                      Preview
                    </DropdownMenuLinkItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setPendingDelete(mcq)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete question?</DialogTitle>
            <DialogDescription>
              This removes the question, its choices, and its attempts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void confirmDelete();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
