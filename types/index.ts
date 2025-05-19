export type SmsResult = {
  name: string;
  phone: string;
  status: "success" | "error";
  message?: string;
};

export type MessageTemplate = {
  text: string;
  hasPlaceholders: boolean;
};
