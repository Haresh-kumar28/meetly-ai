import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },

    task: {
      type: String,
      required: true,
      trim: true,
    },

    assignedTo: {
      type: String,
      default: "Unassigned",
    },

    deadline: {
      type: String,
      default: "No deadline",
    },

    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model("Task", taskSchema);

export default Task;