import { TextField } from "@/components/ui/text-field";

export function Field(
  props: {
    id: string;
    label: string;
    name: string;
    type?: string;
    autoComplete?: string;
    errors?: string[];
  },
) {
  return <TextField required {...props} />;
}
