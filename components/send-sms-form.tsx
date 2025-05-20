"use client"

import type React from "react"
import type { SmsResult } from "@/types"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { sendSmsMessages } from "@/app/actions"

export function SendSmsForm() {
  const [accessToken, setAccessToken] = useState("")
  const [deviceId, setDeviceId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  // Keep default template in state but don't show it in UI
  const [defaultTemplate] = useState("Hi {Name}, this is a message from our company.")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SmsResult[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!accessToken || !deviceId || !file) {
      return
    }

    setIsLoading(true)
    setResults([])

    try {
      const formData = new FormData()
      formData.append("accessToken", accessToken)
      formData.append("deviceId", deviceId)
      formData.append("file", file)
      formData.append("defaultTemplate", defaultTemplate)

      const response = await sendSmsMessages(formData)
      setResults(response)
    } catch (error) {
      console.error("Error sending messages:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="accessToken">Pushbullet Access Token</Label>
          <Input
            id="accessToken"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="o.XXXXXXXXXXXXXXXXXXXXXXXX"
            required
          />
        </div>

        <div>
          <Label htmlFor="deviceId">Target Device ID</Label>
          <Input
            id="deviceId"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="Device identifier"
            required
          />
        </div>

        <div>
          <Label htmlFor="file">Excel File</Label>
          <Input id="file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} required />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending Messages...
          </>
        ) : (
          "Send SMS Messages"
        )}
      </Button>

      {results.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">Results</h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start">
                  {result.status === "success" ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">
                      {result.name} ({result.phone})
                    </p>
                    {result.message && <p className="text-sm text-gray-500 whitespace-pre-line">{result.message}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
