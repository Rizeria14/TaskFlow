let allTasks = [];
let editingId = null;
let activeStatus = "all";
let activePriority = null;

const socket = io({
    transports: ["websocket", "polling"]
});

function showSection(name) {
    document
        .querySelectorAll(".section")
        .forEach(section => {
            section.classList.remove("active");
        });

    document
        .querySelectorAll(".nav-item")
        .forEach(item => {
            item.classList.remove("active");
        });

    document
        .getElementById(`section-${name}`)
        .classList.add("active");

    event?.currentTarget?.classList.add("active");

    if (name === "analytics") {
        loadAnalytics();
    }
}

socket.on("connect", () => {
    socket.emit("join");

    setLiveStatus(true);

    showToast(
        "Live updates connected",
        "success"
    );
});

socket.on("disconnect", () => {
    setLiveStatus(false);

    showToast(
        "Connection lost. Reconnecting...",
        "error"
    );
});

socket.on("connected", data => {
    showToast(
        data.message,
        "info"
    );
});

socket.on("task_added", ({
    task,
    analytics
}) => {
    allTasks.unshift(task);

    renderTasks();

    showToast(
        `Task added: ${task.title}`,
        "success"
    );

    if (
        document
            .getElementById("section-analytics")
            .classList.contains("active")
    ) {
        renderAnalyticsData(analytics);
    }
});

socket.on("task_updated", ({
    task,
    analytics
}) => {
    const index = allTasks.findIndex(
        current => current.id === task.id
    );

    if (index !== -1) {
        allTasks[index] = task;
    }

    renderTasks();

    showToast(
        `Task updated: ${task.title}`,
        "info"
    );

    if (
        document
            .getElementById("section-analytics")
            .classList.contains("active")
    ) {
        renderAnalyticsData(analytics);
    }
});

socket.on("task_deleted", ({
    task_id,
    analytics
}) => {
    allTasks = allTasks.filter(
        task => task.id !== task_id
    );

    renderTasks();

    showToast(
        "Task deleted",
        "error"
    );

    if (
        document
            .getElementById("section-analytics")
            .classList.contains("active")
    ) {
        renderAnalyticsData(analytics);
    }
});

function setLiveStatus(connected) {
    const dot = document.getElementById(
        "live-dot"
    );

    const text = document.getElementById(
        "live-text"
    );

    if (connected) {
        dot.classList.add("connected");

        text.textContent =
            "Live updates active";
    } else {
        dot.classList.remove("connected");

        text.textContent =
            "Reconnecting...";
    }
}

async function api(
    method,
    path,
    body = null
) {
    const options = {
        method,
        headers: {
            "Content-Type":
                "application/json"
        }
    };

    if (body) {
        options.body = JSON.stringify(
            body
        );
    }

    const response = await fetch(
        path,
        options
    );

    return response.json();
}

async function loadTasks() {
    const data = await api(
        "GET",
        "/api/tasks"
    );

    allTasks = data.tasks || [];

    renderTasks();
}

function renderTasks() {
    const container =
        document.getElementById(
            "task-list"
        );

    let tasks = [...allTasks];

    if (activeStatus !== "all") {
        tasks = tasks.filter(
            task =>
                task.status ===
                activeStatus
        );
    }

    if (activePriority) {
        tasks = tasks.filter(
            task =>
                task.priority ===
                activePriority
        );
    }

    if (!tasks.length) {
        container.innerHTML = `
            <div class="loading-state">
                No tasks found
            </div>
        `;

        return;
    }

    container.innerHTML = tasks
        .map(task => `
            <div class="task-card priority-${task.priority}">
                <div class="task-priority-dot"></div>

                <div class="task-body">

                    <div class="task-title">
                        ${escHtml(task.title)}
                    </div>

                    ${
                        task.description
                            ? `
                        <div class="task-desc">
                            ${escHtml(task.description)}
                        </div>
                    `
                            : ""
                    }

                    <div class="task-meta">

                        <span class="badge badge-${task.status}">
                            ${statusLabel(task.status)}
                        </span>

                        <span class="badge badge-date">
                            ${formatDate(task.created_at)}
                        </span>

                        <span class="badge priority-badge priority-${task.priority}">
                            ${task.priority.toUpperCase()}
                        </span>

                    </div>

                </div>

                <div class="task-actions">

                    <button
                        class="task-action-btn edit-btn"
                        onclick="openEditModal(${task.id})"
                    >
                        Edit
                    </button>

                    <button
                        class="task-action-btn delete-btn"
                        onclick="deleteTask(${task.id})"
                    >
                        Delete
                    </button>

                </div>
            </div>
        `)
        .join("");
}

function filterTasks(
    status,
    button
) {
    activeStatus = status;

    activePriority = null;

    document
        .querySelectorAll(".filter-btn")
        .forEach(button => {
            button.classList.remove(
                "active"
            );
        });

    button.classList.add("active");

    renderTasks();
}

function filterPriority(
    priority,
    button
) {
    activePriority =
        activePriority === priority
            ? null
            : priority;

    activeStatus = "all";

    document
        .querySelectorAll(".filter-btn")
        .forEach(button => {
            button.classList.remove(
                "active"
            );
        });

    if (activePriority) {
        button.classList.add(
            "active"
        );
    }

    renderTasks();
}

function openModal() {
    editingId = null;

    document.getElementById(
        "modal-title"
    ).textContent = "Create Task";

    document.getElementById(
        "modal-save-btn"
    ).textContent = "Save Task";

    clearModalFields();

    showModal();
}

function openEditModal(id) {
    const task = allTasks.find(
        current => current.id === id
    );

    if (!task) {
        return;
    }

    editingId = id;

    document.getElementById(
        "modal-title"
    ).textContent = "Edit Task";

    document.getElementById(
        "modal-save-btn"
    ).textContent = "Update Task";

    document.getElementById(
        "task-title"
    ).value = task.title;

    document.getElementById(
        "task-desc"
    ).value = task.description || "";

    document.getElementById(
        "task-priority"
    ).value = task.priority;

    document.getElementById(
        "task-status"
    ).value = task.status;

    showModal();
}

function showModal() {
    document
        .getElementById(
            "modal-overlay"
        )
        .classList.remove("hidden");

    setTimeout(() => {
        document
            .getElementById(
                "task-title"
            )
            .focus();
    }, 100);
}

function closeModal(event) {
    if (
        event &&
        event.target !==
            document.getElementById(
                "modal-overlay"
            )
    ) {
        return;
    }

    document
        .getElementById(
            "modal-overlay"
        )
        .classList.add("hidden");

    clearModalFields();

    editingId = null;
}

function clearModalFields() {
    document.getElementById(
        "task-title"
    ).value = "";

    document.getElementById(
        "task-desc"
    ).value = "";

    document.getElementById(
        "task-priority"
    ).value = "medium";

    document.getElementById(
        "task-status"
    ).value = "pending";
}

async function saveTask() {
    const title = document
        .getElementById(
            "task-title"
        )
        .value.trim();

    const description = document
        .getElementById(
            "task-desc"
        )
        .value.trim();

    const priority = document
        .getElementById(
            "task-priority"
        )
        .value;

    const status = document
        .getElementById(
            "task-status"
        )
        .value;

    if (!title) {
        showToast(
            "Title is required",
            "error"
        );

        return;
    }

    const button =
        document.getElementById(
            "modal-save-btn"
        );

    button.disabled = true;

    try {
        let response;

        if (editingId) {
            response = await api(
                "PUT",
                `/api/tasks/${editingId}`,
                {
                    title,
                    description,
                    priority,
                    status
                }
            );
        } else {
            response = await api(
                "POST",
                "/api/tasks",
                {
                    title,
                    description,
                    priority,
                    status
                }
            );
        }

        if (response.error) {
            showToast(
                response.error,
                "error"
            );
        } else {
            document
                .getElementById(
                    "modal-overlay"
                )
                .classList.add(
                    "hidden"
                );

            clearModalFields();

            editingId = null;
        }
    } finally {
        button.disabled = false;
    }
}

async function deleteTask(id) {
    const confirmed = confirm(
        "Delete this task?"
    );

    if (!confirmed) {
        return;
    }

    const response = await api(
        "DELETE",
        `/api/tasks/${id}`
    );

    if (response.error) {
        showToast(
            response.error,
            "error"
        );
    }
}

async function loadAnalytics() {
    const data = await api(
        "GET",
        "/api/analytics"
    );

    renderAnalyticsData(data);
}

function renderAnalyticsData(data) {
    const grid = document.getElementById(
        "analytics-grid"
    );

    const percentage =
        data.completion_pct ?? 0;

    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">
                Total Tasks
            </div>

            <div class="stat-value stat-accent">
                ${data.total}
            </div>

            <div class="stat-sub">
                ${data.avg_tasks_per_day}/day
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-label">
                Completed
            </div>

            <div class="stat-value stat-green">
                ${data.completed}
            </div>

            <div class="stat-sub">
                Finished tasks
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-label">
                Pending
            </div>

            <div class="stat-value stat-red">
                ${data.pending}
            </div>

            <div class="stat-sub">
                Waiting tasks
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-label">
                In Progress
            </div>

            <div class="stat-value stat-blue">
                ${data.in_progress}
            </div>

            <div class="stat-sub">
                Active work
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-label">
                Completion Rate
            </div>

            <div class="stat-value ${
                percentage >= 75
                    ? "stat-green"
                    : percentage >= 40
                    ? "stat-accent"
                    : "stat-red"
            }">
                ${percentage}%
            </div>

            <div class="stat-sub">
                Tasks completed
            </div>
        </div>
    `;

    renderDonut(data);

    renderPriorityBars(
        data.priority_breakdown || {}
    );
}

function renderDonut(data) {
    const total = data.total || 1;

    const slices = [
        {
            label: "Completed",
            value: data.completed,
            color: "var(--green)"
        },
        {
            label: "In Progress",
            value: data.in_progress,
            color: "var(--blue)"
        },
        {
            label: "Pending",
            value: data.pending,
            color: "var(--accent)"
        }
    ];

    const radius = 50;

    const circumference =
        2 * Math.PI * radius;

    const svg =
        document.getElementById(
            "status-donut"
        );

    const legend =
        document.getElementById(
            "donut-legend"
        );

    [
        ...svg.querySelectorAll(
            "circle.slice"
        )
    ].forEach(circle => {
        circle.remove();
    });

    let offset = 0;

    slices.forEach(slice => {
        const fraction =
            slice.value / total;

        const dash =
            fraction * circumference;

        const circle =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "circle"
            );

        circle.setAttribute(
            "cx",
            60
        );

        circle.setAttribute(
            "cy",
            60
        );

        circle.setAttribute(
            "r",
            radius
        );

        circle.setAttribute(
            "fill",
            "none"
        );

        circle.setAttribute(
            "stroke",
            slice.color
        );

        circle.setAttribute(
            "stroke-width",
            16
        );

        circle.setAttribute(
            "stroke-dasharray",
            `${dash} ${circumference}`
        );

        circle.setAttribute(
            "stroke-dashoffset",
            -offset
        );

        circle.classList.add(
            "slice"
        );

        svg.appendChild(circle);

        offset += dash;
    });

    legend.innerHTML = slices
        .map(slice => `
            <div class="legend-item">

                <span
                    class="legend-dot"
                    style="background:${slice.color}"
                ></span>

                <span>
                    ${slice.label} (${slice.value})
                </span>

            </div>
        `)
        .join("");
}

function renderPriorityBars(
    breakdown
) {
    const container =
        document.getElementById(
            "priority-bars"
        );

    const max = Math.max(
        ...Object.values(
            breakdown
        ),
        1
    );

    const colors = {
        high: "var(--red)",
        medium: "var(--accent)",
        low: "var(--green)"
    };

    container.innerHTML = [
        "high",
        "medium",
        "low"
    ]
        .map(priority => `
            <div class="bar-row">

                <label>
                    <span>
                        ${
                            priority
                                .charAt(0)
                                .toUpperCase()
                            + priority.slice(1)
                        }
                    </span>

                    <span>
                        ${
                            breakdown[
                                priority
                            ] || 0
                        }
                    </span>
                </label>

                <div class="bar-track">

                    <div
                        class="bar-fill"
                        style="
                            width:${
                                (
                                    (
                                        breakdown[
                                            priority
                                        ] || 0
                                    ) / max
                                ) * 100
                            }%;
                            background:${
                                colors[
                                    priority
                                ]
                            }
                        "
                    ></div>

                </div>

            </div>
        `)
        .join("");
}

function statusLabel(status) {
    const labels = {
        pending: "Pending",
        in_progress:
            "In Progress",
        completed: "Completed"
    };

    return (
        labels[status] || status
    );
}

function formatDate(iso) {
    const date = new Date(iso);

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

function escHtml(string) {
    return String(string)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        );
}

let toastTimer;

function showToast(
    message,
    type = "info"
) {
    const toast =
        document.getElementById(
            "toast"
        );

    toast.textContent = message;

    toast.className = `
        toast toast-${type}
    `;

    toast.classList.remove(
        "hidden"
    );

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.add(
            "hidden"
        );
    }, 3500);
}

async function logout() {
    await api(
        "POST",
        "/api/auth/logout"
    );

    window.location.href =
        "/login";
}

document.addEventListener(
    "keydown",
    event => {
        if (event.key === "Escape") {
            document
                .getElementById(
                    "modal-overlay"
                )
                .classList.add(
                    "hidden"
                );

            editingId = null;
        }
    }
);

loadTasks();