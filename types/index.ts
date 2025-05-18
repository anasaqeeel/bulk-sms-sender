export type SmsResult = {
  name: string;
  phone: string;
  status: "success" | "error";
  message?: string;
};
