interface FieldErrorProps {
  errors?: string[];
}

export function FieldError({ errors }: FieldErrorProps) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-rose-700">{errors[0]}</p>;
}
