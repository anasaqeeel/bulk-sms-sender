"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import type { SmsResult } from "@/types";

// Timer delay
const DELAY_MS = 7.5 * 60 * 1000; // 7.5 minutes

// Function to replace placeholders in a message
function replacePlaceholders(
  template: string,
  data: Record<string, string | number | undefined>
): string {
  // First, replace {{placeholder}} format (double curly braces)
  let result = template.replace(/\{\{([^}]+)\}\}/g, (match, placeholder) => {
    const key = placeholder.trim();
    return data[key] !== undefined ? String(data[key]) : match;
  });

  // Then, replace {placeholder} format (single curly braces)
  result = result.replace(/\{([^}]+)\}/g, (match, placeholder) => {
    const key = placeholder.trim();
    return data[key] !== undefined ? String(data[key]) : match;
  });

  return result;
}

export async function sendSmsMessages(
  formData: FormData
): Promise<SmsResult[]> {
  const accessToken = formData.get("accessToken") as string;
  const deviceId = formData.get("deviceId") as string;
  const file = formData.get("file") as File;
  const defaultTemplate = formData.get("defaultTemplate") as string;

  if (!accessToken || !deviceId || !file) {
    throw new Error("Missing required fields");
  }

  // Read the Excel file
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  // Set raw: true to preserve line breaks and formatting
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: true });

  const results: SmsResult[] = [];

  // Process each row
  for (let i = 0; i < data.length; i++) {
    const record = data[i] as Record<string, string | number | undefined>;

    if (!record.Name || !record.PhoneNumber) {
      const errorResult: SmsResult = {
        name: String(record.Name || "Unknown"),
        phone: String(record.PhoneNumber || "Missing"),
        status: "error",
        message: "Missing name or phone number",
      };
      results.push(errorResult);
      continue;
    }

    const name = String(record.Name);
    const phone = String(record.PhoneNumber);

    // Use TextMessage from Excel if available, otherwise use the default template
    const messageTemplate = record.TextMessage
      ? String(record.TextMessage)
      : defaultTemplate;

    // Replace placeholders in the message template
    const message = replacePlaceholders(messageTemplate, record);

    try {
      const response = await fetch("https://api.pushbullet.com/v2/texts", {
        method: "POST",
        headers: {
          "Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            target_device_iden: deviceId,
            addresses: [phone],
            message: message,
          },
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        const successResult: SmsResult = {
          name,
          phone,
          status: "success",
          message: `Message sent: "${message}"`,
        };
        results.push(successResult);
      } else {
        const failResult: SmsResult = {
          name,
          phone,
          status: "error",
          message: responseData.error?.message || "Failed to send message",
        };
        results.push(failResult);
      }

      // Add delay if not the last message
      if (i !== data.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    } catch (error: unknown) {
      const errorResult: SmsResult = {
        name,
        phone,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
      results.push(errorResult);
    }
  }

  revalidatePath("/");
  return results;
}

// New function to get contacts from Excel file
export async function getContactsFromFile(formData: FormData) {
  const file = formData.get("file") as File;

  if (!file) {
    throw new Error("No file provided");
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);

  return data.map((row, index) => {
    const record = row as Record<string, string | number | undefined>;
    return {
      index,
      name: String(record.Name || "Unknown"),
      phone: String(record.PhoneNumber || "Missing"),
      textMessage: record.TextMessage ? String(record.TextMessage) : null,
    };
  });
}

// New function to send a single SMS
export async function sendSingleSms(
  accessToken: string,
  deviceId: string,
  name: string,
  phone: string,
  message: string
): Promise<SmsResult> {
  try {
    const response = await fetch("https://api.pushbullet.com/v2/texts", {
      method: "POST",
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          target_device_iden: deviceId,
          addresses: [phone],
          message: message,
        },
      }),
    });

    const responseData = await response.json();

    if (response.ok) {
      return {
        name,
        phone,
        status: "success",
        message: `Message sent: "${message}"`,
      };
    } else {
      return {
        name,
        phone,
        status: "error",
        message: responseData.error?.message || "Failed to send message",
      };
    }
  } catch (error: unknown) {
    return {
      name,
      phone,
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
