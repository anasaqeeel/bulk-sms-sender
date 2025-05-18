"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import type { SmsResult } from "@/types";

export async function sendSmsMessages(
  formData: FormData
): Promise<SmsResult[]> {
  const accessToken = formData.get("accessToken") as string;
  const deviceId = formData.get("deviceId") as string;
  const file = formData.get("file") as File;

  if (!accessToken || !deviceId || !file) {
    throw new Error("Missing required fields");
  }

  // Read the Excel file
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);

  const results: SmsResult[] = [];

  // Process each row
  for (const row of data) {
    const record = row as Record<string, string | number | undefined>;

    if (!record.Name || !record.PhoneNumber) {
      results.push({
        name: String(record.Name || "Unknown"),
        phone: String(record.PhoneNumber || "Missing"),
        status: "error",
        message: "Missing name or phone number",
      });
      continue;
    }

    const name = String(record.Name);
    const phone = String(record.PhoneNumber);
    const message = `Hi ${name}, this is a test message from Pushbullet SMS.`;

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
        results.push({
          name,
          phone,
          status: "success",
          message: "Message sent successfully",
        });
      } else {
        results.push({
          name,
          phone,
          status: "error",
          message: responseData.error?.message || "Failed to send message",
        });
      }

      // Add a small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: unknown) {
      results.push({
        name,
        phone,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  revalidatePath("/");
  return results;
}
