import React, { useState, useEffect } from "react";

interface Email {
    emailId: string;
    to: string;
    from: string;
    subject: string;
    body: string;
    status: string;
    createdAt: string;
    sentAt: string;
}

interface EmailOutboxProps {
    userEmail?: string;
}

const EmailOutbox: React.FC<EmailOutboxProps> = ({ userEmail }) => {
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showCompose, setShowCompose] = useState(false);
    const [composeData, setComposeData] = useState({ to: "", subject: "", body: "" });
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchEmails();
    }, []);

    const fetchEmails = async () => {
        try {
            const res = await fetch("http://localhost:4000/api/emails/outbox?limit=100");
            const data = await res.json();
            setEmails(data.data || []);
        } catch (err) {
            console.error("Error fetching emails:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        if (!composeData.to || !composeData.subject) {
            alert("Please fill in To and Subject fields");
            return;
        }

        setSending(true);
        try {
            const res = await fetch("http://localhost:4000/api/emails/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: composeData.to,
                    subject: composeData.subject,
                    body: composeData.body
                })
            });

            if (res.ok) {
                setShowCompose(false);
                setComposeData({ to: "", subject: "", body: "" });
                fetchEmails();
            } else {
                alert("Failed to send email");
            }
        } catch (err) {
            console.error("Error sending email:", err);
            alert("Failed to send email");
        } finally {
            setSending(false);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
        });
    };

    const formatFullDate = (dateStr: string) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "sent": return { bg: "#e6f4ea", text: "#1e7e34" };
            case "pending": return { bg: "#fff3cd", text: "#856404" };
            case "failed": return { bg: "#f8d7da", text: "#721c24" };
            default: return { bg: "#e9ecef", text: "#495057" };
        }
    };

    const filteredEmails = emails.filter(email =>
        email.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.body.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const styles: { [key: string]: React.CSSProperties } = {
        container: {
            display: "flex",
            height: "calc(100vh - 120px)",
            background: "#fff",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            overflow: "hidden"
        },
        sidebar: {
            width: "240px",
            background: "#f8f9fa",
            borderRight: "1px solid #e0e0e0",
            display: "flex",
            flexDirection: "column"
        },
        sidebarHeader: {
            padding: "16px",
            borderBottom: "1px solid #e0e0e0"
        },
        composeBtn: {
            width: "100%",
            padding: "12px 20px",
            background: "#0078d4",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
        },
        folderList: {
            padding: "8px 0"
        },
        folderItem: {
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
            fontSize: "14px",
            color: "#323130",
            background: "#e6f2ff",
            borderLeft: "3px solid #0078d4"
        },
        stats: {
            padding: "16px",
            borderTop: "1px solid #e0e0e0",
            marginTop: "auto"
        },
        statItem: {
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            color: "#666",
            marginBottom: "8px"
        },
        emailList: {
            width: "380px",
            borderRight: "1px solid #e0e0e0",
            display: "flex",
            flexDirection: "column",
            background: "#fff"
        },
        listHeader: {
            padding: "12px 16px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            alignItems: "center",
            gap: "12px"
        },
        searchBox: {
            flex: 1,
            padding: "8px 12px",
            border: "1px solid #e0e0e0",
            borderRadius: "4px",
            fontSize: "14px",
            outline: "none"
        },
        refreshBtn: {
            padding: "8px 12px",
            background: "transparent",
            border: "1px solid #e0e0e0",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px"
        },
        listContent: {
            flex: 1,
            overflowY: "auto"
        },
        emailItem: {
            padding: "14px 16px",
            borderBottom: "1px solid #f0f0f0",
            cursor: "pointer",
            transition: "background 0.15s"
        },
        emailItemSelected: {
            background: "#e6f2ff",
            borderLeft: "3px solid #0078d4"
        },
        emailTo: {
            fontSize: "14px",
            fontWeight: "600",
            color: "#323130",
            marginBottom: "4px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
        },
        emailSubject: {
            fontSize: "13px",
            color: "#323130",
            marginBottom: "4px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
        },
        emailPreview: {
            fontSize: "12px",
            color: "#666",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
        },
        emailDate: {
            fontSize: "11px",
            color: "#888"
        },
        statusBadge: {
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "10px",
            fontWeight: "500",
            textTransform: "uppercase"
        },
        detailPane: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "#fafafa"
        },
        detailEmpty: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#888",
            fontSize: "14px"
        },
        detailHeader: {
            padding: "20px 24px",
            background: "#fff",
            borderBottom: "1px solid #e0e0e0"
        },
        detailSubject: {
            fontSize: "20px",
            fontWeight: "600",
            color: "#323130",
            marginBottom: "16px"
        },
        detailMeta: {
            display: "flex",
            alignItems: "flex-start",
            gap: "12px"
        },
        detailAvatar: {
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#0078d4",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "600",
            fontSize: "16px"
        },
        detailInfo: {
            flex: 1
        },
        detailFrom: {
            fontSize: "14px",
            fontWeight: "600",
            color: "#323130"
        },
        detailTo: {
            fontSize: "13px",
            color: "#666",
            marginTop: "2px"
        },
        detailTime: {
            fontSize: "12px",
            color: "#888",
            marginTop: "4px"
        },
        detailBody: {
            flex: 1,
            padding: "24px",
            overflowY: "auto",
            background: "#fff",
            margin: "16px 24px",
            borderRadius: "8px",
            border: "1px solid #e0e0e0"
        },
        bodyContent: {
            fontSize: "14px",
            lineHeight: "1.6",
            color: "#323130",
            whiteSpace: "pre-wrap"
        },
        composeOverlay: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
        },
        composeModal: {
            width: "600px",
            maxHeight: "80vh",
            background: "#fff",
            borderRadius: "8px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column"
        },
        composeHeader: {
            padding: "16px 20px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
        },
        composeTitle: {
            fontSize: "16px",
            fontWeight: "600",
            color: "#323130"
        },
        closeBtn: {
            background: "transparent",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
            color: "#666"
        },
        composeForm: {
            padding: "16px 20px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "12px"
        },
        formField: {
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #e0e0e0",
            paddingBottom: "12px"
        },
        formLabel: {
            width: "60px",
            fontSize: "14px",
            color: "#666"
        },
        formInput: {
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "14px",
            padding: "4px 0"
        },
        formTextarea: {
            flex: 1,
            border: "1px solid #e0e0e0",
            borderRadius: "4px",
            padding: "12px",
            fontSize: "14px",
            minHeight: "200px",
            resize: "vertical",
            outline: "none"
        },
        composeFooter: {
            padding: "12px 20px",
            borderTop: "1px solid #e0e0e0",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px"
        },
        sendBtn: {
            padding: "10px 24px",
            background: "#0078d4",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer"
        },
        cancelBtn: {
            padding: "10px 24px",
            background: "#fff",
            color: "#323130",
            border: "1px solid #e0e0e0",
            borderRadius: "4px",
            fontSize: "14px",
            cursor: "pointer"
        },
        loadingContainer: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666"
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loadingContainer}>Loading emails...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Left Sidebar */}
            <div style={styles.sidebar}>
                <div style={styles.sidebarHeader}>
                    <button style={styles.composeBtn} onClick={() => setShowCompose(true)}>
                        <span>✉</span> New Email
                    </button>
                </div>

                <div style={styles.folderList}>
                    <div style={styles.folderItem}>
                        <span>📤</span>
                        <span>Sent</span>
                        <span style={{ marginLeft: "auto", fontSize: "12px", color: "#666" }}>
                            {emails.length}
                        </span>
                    </div>
                </div>

                <div style={styles.stats}>
                    <div style={styles.statItem}>
                        <span>Total Sent</span>
                        <strong>{emails.filter(e => e.status === "sent").length}</strong>
                    </div>
                    <div style={styles.statItem}>
                        <span>Pending</span>
                        <strong>{emails.filter(e => e.status === "pending").length}</strong>
                    </div>
                    <div style={styles.statItem}>
                        <span>Failed</span>
                        <strong style={{ color: "#dc3545" }}>
                            {emails.filter(e => e.status === "failed").length}
                        </strong>
                    </div>
                </div>
            </div>

            {/* Email List */}
            <div style={styles.emailList}>
                <div style={styles.listHeader}>
                    <input
                        type="text"
                        placeholder="Search emails..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={styles.searchBox}
                    />
                    <button style={styles.refreshBtn} onClick={fetchEmails} title="Refresh">
                        🔄
                    </button>
                </div>

                <div style={styles.listContent}>
                    {filteredEmails.length === 0 ? (
                        <div style={{ padding: "40px 20px", textAlign: "center", color: "#888" }}>
                            {searchTerm ? "No emails match your search" : "No emails sent yet"}
                        </div>
                    ) : (
                        filteredEmails.map((email) => {
                            const statusColor = getStatusColor(email.status);
                            const isSelected = selectedEmail?.emailId === email.emailId;

                            return (
                                <div
                                    key={email.emailId}
                                    style={{
                                        ...styles.emailItem,
                                        ...(isSelected ? styles.emailItemSelected : {}),
                                        background: isSelected ? "#e6f2ff" : "transparent"
                                    }}
                                    onClick={() => setSelectedEmail(email)}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = "#f5f5f5";
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = "transparent";
                                    }}
                                >
                                    <div style={styles.emailTo}>
                                        <span style={{
                                            maxWidth: "200px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap"
                                        }}>
                                            {email.to}
                                        </span>
                                        <span style={styles.emailDate}>{formatDate(email.createdAt)}</span>
                                    </div>
                                    <div style={styles.emailSubject}>{email.subject}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span
                                            style={{
                                                ...styles.statusBadge,
                                                background: statusColor.bg,
                                                color: statusColor.text
                                            }}
                                        >
                                            {email.status}
                                        </span>
                                        <span style={styles.emailPreview}>
                                            {email.body.substring(0, 50)}...
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Detail Pane */}
            <div style={styles.detailPane}>
                {selectedEmail ? (
                    <>
                        <div style={styles.detailHeader}>
                            <div style={styles.detailSubject}>{selectedEmail.subject}</div>
                            <div style={styles.detailMeta}>
                                <div style={styles.detailAvatar}>
                                    {selectedEmail.from.charAt(0).toUpperCase()}
                                </div>
                                <div style={styles.detailInfo}>
                                    <div style={styles.detailFrom}>{selectedEmail.from}</div>
                                    <div style={styles.detailTo}>To: {selectedEmail.to}</div>
                                    <div style={styles.detailTime}>
                                        {formatFullDate(selectedEmail.createdAt)}
                                    </div>
                                </div>
                                <span
                                    style={{
                                        ...styles.statusBadge,
                                        background: getStatusColor(selectedEmail.status).bg,
                                        color: getStatusColor(selectedEmail.status).text,
                                        padding: "4px 10px",
                                        fontSize: "11px"
                                    }}
                                >
                                    {selectedEmail.status}
                                </span>
                            </div>
                        </div>
                        <div style={styles.detailBody}>
                            <div style={styles.bodyContent}>{selectedEmail.body}</div>
                        </div>
                    </>
                ) : (
                    <div style={styles.detailEmpty}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📧</div>
                            <div>Select an email to view its contents</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Compose Modal */}
            {showCompose && (
                <div style={styles.composeOverlay} onClick={() => setShowCompose(false)}>
                    <div style={styles.composeModal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.composeHeader}>
                            <span style={styles.composeTitle}>New Email</span>
                            <button style={styles.closeBtn} onClick={() => setShowCompose(false)}>
                                ×
                            </button>
                        </div>

                        <div style={styles.composeForm}>
                            <div style={styles.formField}>
                                <label style={styles.formLabel}>To:</label>
                                <input
                                    type="email"
                                    style={styles.formInput}
                                    placeholder="recipient@example.com"
                                    value={composeData.to}
                                    onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                                />
                            </div>
                            <div style={styles.formField}>
                                <label style={styles.formLabel}>Subject:</label>
                                <input
                                    type="text"
                                    style={styles.formInput}
                                    placeholder="Email subject"
                                    value={composeData.subject}
                                    onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                                />
                            </div>
                            <textarea
                                style={styles.formTextarea}
                                placeholder="Write your message here..."
                                value={composeData.body}
                                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                            />
                        </div>

                        <div style={styles.composeFooter}>
                            <button style={styles.cancelBtn} onClick={() => setShowCompose(false)}>
                                Cancel
                            </button>
                            <button
                                style={{
                                    ...styles.sendBtn,
                                    opacity: sending ? 0.7 : 1,
                                    cursor: sending ? "not-allowed" : "pointer"
                                }}
                                onClick={handleSendEmail}
                                disabled={sending}
                            >
                                {sending ? "Sending..." : "Send Email"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailOutbox;