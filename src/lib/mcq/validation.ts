export const EMPTY_TEXT_BOX_MESSAGE = "text box is empty";
export const NO_CORRECT_ANSWER_MESSAGE = "none of answer is selected";
export const ANSWER_NOT_SELECTED_MESSAGE = "answer not selected";

export function collectMcqFormIssues(input: {
  name: string;
  question: string;
  choiceTexts: string[];
  hasCorrectChoice: boolean;
}): string[] {
  const issues: string[] = [];
  const hasEmptyField =
    input.name.trim() === "" ||
    input.question.trim() === "" ||
    input.choiceTexts.some((text) => text.trim() === "");

  if (hasEmptyField) {
    issues.push(EMPTY_TEXT_BOX_MESSAGE);
  }

  if (!input.hasCorrectChoice) {
    issues.push(NO_CORRECT_ANSWER_MESSAGE);
  }

  return issues;
}
