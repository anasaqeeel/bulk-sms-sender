import { SendSmsForm } from "@/components/send-sms-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              SMS Sender
            </h1>
            <p className="mt-3 text-lg text-gray-600">
              Upload your contacts and send SMS messages
            </p>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6">
            <SendSmsForm />
          </div>
        </div>
      </div>
    </div>
  );
}
