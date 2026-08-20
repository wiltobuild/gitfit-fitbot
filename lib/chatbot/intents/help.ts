import type { Intent } from "@/lib/chatbot/types";

const helpKeywords = ["help", "what can you do", "what can you help with"];

export const helpIntent: Intent = {
  id: "help",
  description: "Explains the chatbot's current capabilities.",
  roles: ["client", "staff", "admin"],
  match: (message) => {
    const normalizedMessage = message.toLowerCase();

    return !/\bplan\b.*\b(week|workout)\b|\b(workout|week)\b.*\bplan\b/.test(normalizedMessage) && helpKeywords.some((keyword) => normalizedMessage.includes(keyword));
  },
  handle: (_message, session) => {
    if (session.role === "admin") {
      return {
        reply:
          "I’m here to help you run the studio as well as support your own fitness routine. You have all staff capabilities, including schedule questions, member lookup, outreach, and time-off tools. You can also approve or deny a pending staff time-off request by naming the person and date, alongside class booking and workout guidance.",
      };
    }

    if (session.role === "staff") {
      return {
        reply:
          "I’m here to help you stay connected to your fitness routine. Right now, I can chat through your fitness goals, point you to the Book a Class module to reserve a class, help you check your dashboard, and answer schedule questions — ask about a day, an instructor, a class type, or how full a class is. Member lookup and more staff tools are coming soon.",
      };
    }

    return {
      reply:
        "I’m here to help you keep moving. Right now, we can talk through your fitness goals, I can point you to the Book a Class module to reserve a class, help you check your dashboard, and answer schedule questions — ask about a day, an instructor, a class type, or how full a class is. Let’s make this week count.",
    };
  },
};
