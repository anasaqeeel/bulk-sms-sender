"use client"

import type React from "react"
import type { SmsResult } from "@/types"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Loader2, Clock } from "lucide-react"
import { getContactsFromFile, sendSingleSms } from "@/app/actions"

type ProgressLog = {
  id: string
  message: string
  type: "success" | "error" | "waiting" | "info"
  timestamp: Date
}

type Contact = {
  index: number
  name: string
  phone: string
  textMessage: string | null
}

export function SendSmsForm() {
  const [accessToken, setAccessToken] = useState("")
  const [deviceId, setDeviceId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [defaultTemplate] = useState("Hi {Name}, this is a message from our company.")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SmsResult[]>([])
  const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([])
  const [currentStatus, setCurrentStatus] = useState("")
  const [countdown, setCountdown] = useState(0)

  // Add a counter ref to ensure unique IDs
  const logIdCounter = useRef(0)

  const addProgressLog = (message: string, type: ProgressLog["type"]) => {
    // Generate a truly unique ID by combining timestamp with an incrementing counter
    const uniqueId = `${Date.now()}-${logIdCounter.current++}`

    const newLog: ProgressLog = {
      id: uniqueId,
      message,
      type,
      timestamp: new Date(),
    }
    setProgressLogs((prev) => [...prev, newLog])
  }

  const replacePlaceholders = (template: string, data: Record<string, string>) => {
    let result = template.replace(/\{\{([^}]+)\}\}/g, (match, placeholder) => {
      const key = placeholder.trim()
      return data[key] !== undefined ? String(data[key]) : match
    })

    result = result.replace(/\{([^}]+)\}/g, (match, placeholder) => {
      const key = placeholder.trim()
      return data[key] !== undefined ? String(data[key]) : match
    })

    return result
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const startCountdown = (seconds: number) => {
    setCountdown(seconds)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!accessToken || !deviceId || !file) {
      return
    }

    setIsLoading(true)
    setResults([])
    setProgressLogs([])
    setCurrentStatus("Loading contacts...")

    // Reset the counter when starting a new batch
    logIdCounter.current = 0

    try {
      // Get contacts from file
      const formData = new FormData()
      formData.append("file", file)
      const contacts: Contact[] = await getContactsFromFile(formData)

      addProgressLog(`📁 Loaded ${contacts.length} contacts from Excel file`, "info")
      setCurrentStatus(`Processing ${contacts.length} contacts...`)

      const newResults: SmsResult[] = []
      const DELAY_MS = 7.5 * 60 * 1000 // 7.5 minutes

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]

        if (!contact.name || !contact.phone || contact.phone === "Missing") {
          const errorResult: SmsResult = {
            name: contact.name,
            phone: contact.phone,
            status: "error",
            message: "Missing name or phone number",
          }
          newResults.push(errorResult)
          setResults([...newResults])
          addProgressLog(`❌ Error for ${contact.phone}: Missing name or phone number`, "error")
          continue
        }

        setCurrentStatus(`Sending message ${i + 1} of ${contacts.length} to ${contact.name}...`)

        // Prepare message
        const messageTemplate = contact.textMessage || defaultTemplate
        const message = replacePlaceholders(messageTemplate, {
          Name: contact.name,
          PhoneNumber: contact.phone,
        })

        // Send SMS
        const result = await sendSingleSms(accessToken, deviceId, contact.name, contact.phone, message)
        newResults.push(result)
        setResults([...newResults])

        if (result.status === "success") {
          addProgressLog(`✅ Sent to ${contact.phone} (${contact.name})`, "success")
        } else {
          addProgressLog(`❌ Failed for ${contact.phone}: ${result.message}`, "error")
        }

        // Add delay if not the last message
        if (i !== contacts.length - 1) {
          const delaySeconds = DELAY_MS / 1000
          setCurrentStatus(`⏳ Waiting ${Math.floor(delaySeconds / 60)}m ${delaySeconds % 60}s before next message...`)
          addProgressLog(
            `⏳ Waiting ${Math.floor(delaySeconds / 60)}m ${delaySeconds % 60}s before next message...`,
            "waiting",
          )

          startCountdown(delaySeconds)
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
        }
      }

      setCurrentStatus("✅ All messages processed!")
      addProgressLog("🎉 All messages have been processed!", "success")
    } catch (error) {
      console.error("Error sending messages:", error)
      addProgressLog(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`, "error")
      setCurrentStatus("❌ Error occurred while processing messages")
    } finally {
      setIsLoading(false)
      setCountdown(0)
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

      {/* Current Status */}
      {isLoading && currentStatus && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
            <span className="text-blue-800 font-medium">{currentStatus}</span>
          </div>
          {countdown > 0 && (
            <div className="mt-2 flex items-center text-blue-600">
              <Clock className="mr-2 h-4 w-4" />
              <span className="font-mono text-lg">
                {Math.floor(countdown / 60)}m {countdown % 60}s remaining
              </span>
            </div>
          )}
        </div>
      )}

      {/* Progress Logs */}
      {progressLogs.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">Progress Log</h3>
          <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-4 bg-gray-50">
            {progressLogs.map((log) => (
              <div key={log.id} className="text-sm">
                <span className="text-gray-500 font-mono">{log.timestamp.toLocaleTimeString()}</span>
                <span className="ml-2">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">Results ({results.length} processed)</h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <Card key={`result-${index}`} className="p-4">
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
