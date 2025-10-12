import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Textarea } from "@umamin/ui/components/textarea";
import type { LucideIcon } from "lucide-react";
import { LoadingIcon } from "@/components/loading-icon";

const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

function TextField({
  label,
  isRequired,
  ...props
}: { label: string; isRequired?: boolean } & React.ComponentProps<"input">) {
  const field = useFieldContext<string>();

  return (
    <div>
      <Label htmlFor={field.name} className="h-7">
        {label}
        {isRequired && <span className="text-destructive">*</span>}
      </Label>
      <Input
        {...props}
        id={field.name}
        value={field.state.value}
        onChange={(e) =>
          field.handleChange(e.target.value.replace(/\s+/g, " "))
        }
      />

      {field.state.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">
          {field.state.meta.errors[0].message}
        </p>
      )}
    </div>
  );
}

function TextareaField({
  label,
  isRequired,
  ...props
}: { label: string; isRequired?: boolean } & React.ComponentProps<"textarea">) {
  const field = useFieldContext<string>();

  return (
    <div>
      <Label htmlFor={field.name} className="h-7">
        {label}
        {isRequired && <span className="text-destructive">*</span>}
      </Label>
      <Textarea
        {...props}
        id={field.name}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
      />

      {field.state.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">
          {field.state.meta.errors[0].message}
        </p>
      )}
    </div>
  );
}

function SubmitButton({
  label,
  icon,
  disabled,
  ...props
}: { label: string; icon?: LucideIcon } & React.ComponentProps<"button">) {
  const form = useFormContext();

  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button disabled={isSubmitting || !canSubmit || disabled} {...props}>
          <LoadingIcon icon={icon} loading={isSubmitting || !!disabled} />
          {label}
        </Button>
      )}
    </form.Subscribe>
  );
}

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    TextareaField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
});
