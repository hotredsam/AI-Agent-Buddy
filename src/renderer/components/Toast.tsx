import React, { useEffect, useState } from 'react'

export interface ToastMessage {
  id: string
  text: string
  type: 'error' | 'warning'
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onDismiss(toast.id), 220)
    }, 5000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const handleClose = () => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 220)
  }

  return (
    <div className={`toast ${toast.type} ${exiting ? 'exiting' : ''}`}>
      <span className="toast-message">{toast.text}</span>
      <button className="toast-close-btn" onClick={handleClose} title="Dismiss">
        &#x2715;
      </button>
    </div>
  )
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
