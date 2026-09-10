"use strict";

// This content is server-only. Do not move permission-scoped entries into public assets.
const FAQ_SECTIONS = Object.freeze([
  {
    "id": "getting-started",
    "audience": "public",
    "icon": "👋",
    "title": "Getting Started",
    "items": [
      {
        "question": "What is the Fire Of God Ministries Community Portal?",
        "answer": "The Community Portal is our shared online space for the Fire Of God Ministries family. It brings together events, member information, ministries, prayer, growth activities, games, reminders, and other helpful community features in one place."
      },
      {
        "question": "Do I need an account?",
        "answer": "Some parts can be viewed without signing in. An account is needed for things that belong to you personally, such as your profile, growth journey, attendance, schedule, scores, messages, and other saved activities."
      },
      {
        "question": "Can I add the Community Portal to my phone?",
        "answer": "Yes. You can add the Community Portal to your phone’s Home Screen so it is easier to open and feels more like an app."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "account-sign-in",
    "audience": "public",
    "icon": "👤",
    "title": "Account & Sign In",
    "items": [
      {
        "question": "How do I sign in?",
        "answer": "Open the Sign In page and choose the option that matches your account. You may use your Community Portal account or Google Sign-In when it is available for you."
      },
      {
        "question": "What if I forget my password?",
        "answer": "Tap “Forgot password?” on the Sign In page. Enter your email and follow the instructions that are sent to you if your account can use password recovery."
      },
      {
        "question": "Why doesn’t the Portal tell me if an email is registered?",
        "answer": "This helps protect everyone’s privacy. The Portal gives the same message whether or not an email is connected to an account."
      },
      {
        "question": "Can I use Google Sign-In?",
        "answer": "Yes, when it is available for your account. Google Sign-In lets you use your verified Google account to enter the Community Portal."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "home-dashboard",
    "audience": "member",
    "icon": "🏠",
    "title": "Home Dashboard",
    "items": [
      {
        "question": "What is the Home Dashboard?",
        "answer": "The Home Dashboard is your starting place after you sign in. It brings together the things that may matter to you today, such as your growth journey, upcoming events, schedule, prayer, community activities, and helpful shortcuts."
      },
      {
        "question": "Why do different members see different things?",
        "answer": "Some cards and choices appear only when they are useful for your account, ministry, role, or permissions. This helps keep the Home page simple and relevant."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "growth-planner",
    "audience": "member",
    "icon": "🌱",
    "title": "Growth & Planner",
    "items": [
      {
        "question": "What is Growth & Planner?",
        "answer": "Growth & Planner helps you see your personal next steps and keep track of the activities that support your journey in faith, community, formation, and service."
      },
      {
        "question": "What is the purpose of the Planner?",
        "answer": "The Planner helps you remember what is coming up and what you may want to do next. It can bring together personal activities, responsibilities, and growth-related reminders."
      },
      {
        "question": "Can everyone see my personal growth information?",
        "answer": "No. Personal information is shown only where it is meant to be shared. Some parts are for you, while other parts may be visible only to the right leaders when needed."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "my-journey-seven-milestones",
    "audience": "member",
    "icon": "🛤️",
    "title": "My Journey & Seven Milestones",
    "items": [
      {
        "question": "What is My Journey?",
        "answer": "My Journey helps you see where you are in your life with the community and what your next step may be. It is meant to encourage growth, belonging, service, and mission."
      },
      {
        "question": "What are the seven milestones?",
        "answer": "The seven milestones are: Encounter (Come & See), Connect & Belong, Step In (Pledge), Discover Your Gifts, Equip & Form, Serve with Joy, and Commissioned (Be Sent)."
      },
      {
        "question": "Do milestones measure how holy or valuable I am?",
        "answer": "No. Milestones are simply encouragement and guidance. They do not measure your holiness, your value, or God’s favor."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "daily-gospel-daily-manna",
    "audience": "member",
    "icon": "📖",
    "title": "Daily Gospel & Daily Manna",
    "items": [
      {
        "question": "What are Daily Gospel and Daily Manna?",
        "answer": "These areas help you return to Scripture and reflection during ordinary days, not only during gatherings. They are there to support a regular habit of listening to God’s Word."
      },
      {
        "question": "How do I use them?",
        "answer": "Open the daily reading or reflection, read at your own pace, and return whenever you want to spend time with Scripture."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "prayer-center-prayer-covenant-prayer-pal",
    "audience": "member",
    "icon": "🙏",
    "title": "Prayer Center, Prayer Covenant & Prayer Pal",
    "items": [
      {
        "question": "What is the Prayer Center?",
        "answer": "The Prayer Center brings together prayer-related activities available to you in the Community Portal."
      },
      {
        "question": "What is the Prayer Covenant?",
        "answer": "The Prayer Covenant is a simple way to take part in the community’s shared rhythm of prayer and remember the people or intentions you have committed to pray for."
      },
      {
        "question": "What is Prayer Pal?",
        "answer": "Prayer Pal helps members remember and pray for another person in the community when that activity is available."
      },
      {
        "question": "Can other people see my private prayer information?",
        "answer": "Prayer information should only be shared with the people it is meant for. Avoid putting very sensitive information in a place meant for wider sharing."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "spiritual-journal",
    "audience": "member",
    "icon": "✍️",
    "title": "Spiritual Journal",
    "items": [
      {
        "question": "What is the Spiritual Journal?",
        "answer": "The Spiritual Journal is a personal place for gratitude, reflections, prayer notes, and thoughts about your journey with God."
      },
      {
        "question": "Is my Journal public?",
        "answer": "No. It is meant to be a personal space. You should still avoid sharing anything there that you would not want stored in your account."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "life-points-growth-xp",
    "audience": "member",
    "icon": "✨",
    "title": "Life Points & Growth XP",
    "items": [
      {
        "question": "What are Life Points and Growth XP?",
        "answer": "They are encouragement tools that can help make participation and growth activities more engaging."
      },
      {
        "question": "Do points or rankings show who is more spiritual?",
        "answer": "No. Points, ranks, milestones, and participation records are never a measure of holiness, personal worth, or God’s favor."
      },
      {
        "question": "Where can I see my points or progress?",
        "answer": "When available, you can see them in the parts of the Portal connected to your growth, activities, or rankings."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "silas-ai-assistant",
    "audience": "member",
    "icon": "💬",
    "title": "Silas AI Assistant",
    "items": [
      {
        "question": "Who is Silas?",
        "answer": "Silas is the Community Portal’s AI helper. Silas is designed to make it easier to find help, understand Portal features, and support ministry-related questions inside the app."
      },
      {
        "question": "Is Silas a replacement for a leader, shepherd, priest, or real conversation?",
        "answer": "No. Silas is a helpful tool, but it does not replace prayer, pastoral care, spiritual guidance, community relationships, or conversations with the right people."
      },
      {
        "question": "Should I share very private information with Silas?",
        "answer": "Use good judgment with personal information. For sensitive pastoral, family, health, or private matters, it is better to speak directly with the appropriate person."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "events-registration",
    "audience": "public",
    "icon": "📅",
    "title": "Events & Registration",
    "items": [
      {
        "question": "Where can I see upcoming events?",
        "answer": "Open Events to see what is coming up, including the date, time, place, poster, and other event details."
      },
      {
        "question": "How do I register for an event?",
        "answer": "Open the event and tap the registration button when it is available. Fill in the requested details and submit the form."
      },
      {
        "question": "Can I invite or share an event with someone?",
        "answer": "Yes. When an event has a Share Invite button, you can send it to family, friends, or other community members."
      },
      {
        "question": "Why does a shared event show a picture and title?",
        "answer": "The Portal prepares an event preview so the person receiving your link can quickly see what the event is about."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "qr-check-in-my-schedule",
    "audience": "member",
    "icon": "▦",
    "title": "QR Check-In & My Schedule",
    "items": [
      {
        "question": "What is my member QR code for?",
        "answer": "Your member QR code helps make attendance and check-in easier during supported community events and activities."
      },
      {
        "question": "Is my member QR code a password?",
        "answer": "No. Your QR code helps identify your member record during check-in. Your account password should still be kept private."
      },
      {
        "question": "What is My Schedule?",
        "answer": "My Schedule shows event responsibilities or activities assigned to you when that information is available for your account."
      },
      {
        "question": "Can I see my attendance history?",
        "answer": "Where this feature is available, you can view your recorded attendance in your member area."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "ministries-serving",
    "audience": "member",
    "icon": "🤝",
    "title": "Ministries & Serving",
    "items": [
      {
        "question": "What can I find in Ministries & Serving?",
        "answer": "You can discover ministries, see where you may be involved, express interest in serving, and view ministry information available to your account."
      },
      {
        "question": "Does having a Portal account automatically mean I joined a ministry?",
        "answer": "No. Your Portal account and ministry membership are separate. Ministry membership still follows the community’s normal guidance and leadership."
      },
      {
        "question": "Can I see my ministry role or availability?",
        "answer": "Yes, when that information is part of your account and has been made available to you."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "campfires-small-groups",
    "audience": "member",
    "icon": "🔥",
    "title": "Campfires & Small Groups",
    "items": [
      {
        "question": "What are Campfires?",
        "answer": "Campfires are smaller community spaces for fellowship, prayer, discussion, shared memories, and journeying together."
      },
      {
        "question": "Will everyone see the same Campfire?",
        "answer": "Not always. What you see may depend on the group or community space that you belong to."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "inbox-announcements-notifications",
    "audience": "member",
    "icon": "🔔",
    "title": "Inbox, Announcements & Notifications",
    "items": [
      {
        "question": "What is the Inbox for?",
        "answer": "The Inbox is where you may receive messages or updates meant for you inside the Community Portal."
      },
      {
        "question": "What are announcements?",
        "answer": "Announcements are community updates shared with the people who need to receive them."
      },
      {
        "question": "Why should I turn on notifications?",
        "answer": "Notifications can help you remember events, receive important updates, and stay connected with community activities."
      },
      {
        "question": "Why am I not receiving notifications?",
        "answer": "Check that notifications are allowed for the Community Portal on your phone or browser. If you changed devices or settings, you may need to allow them again."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "worship-hub",
    "audience": "member",
    "icon": "🎵",
    "title": "Worship Hub",
    "items": [
      {
        "question": "What is the Worship Hub?",
        "answer": "The Worship Hub brings together worship resources that are available to your account, such as songs, setlists, keys, tempo information, media, and chord resources."
      },
      {
        "question": "Why can’t I see every Worship Hub feature?",
        "answer": "Some worship resources may be shown only to members who need them for their ministry or role."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "faith-quest-challenge",
    "audience": "member",
    "icon": "✝",
    "title": "Faith Quest Challenge",
    "items": [
      {
        "question": "What is Faith Quest Challenge?",
        "answer": "Faith Quest Challenge is our faith-learning game area. It is for Bible, Scripture, Catechism, theology, and other Christian learning activities."
      },
      {
        "question": "What kind of activities will I find here?",
        "answer": "You may find quizzes, memory challenges, Bible questions, Catechism topics, and other fun ways to learn more about the Christian faith."
      },
      {
        "question": "Can Faith Quest Challenge have scores or rankings?",
        "answer": "Yes. Some challenges may give scores, points, or rankings so members can enjoy learning together in a fun and friendly way."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "sports-fitness",
    "audience": "member",
    "icon": "🏃",
    "title": "Sports & Fitness",
    "items": [
      {
        "question": "What is Sports & Fitness?",
        "answer": "Sports & Fitness is for movement, exercise, wellness, and sports-related activities."
      },
      {
        "question": "Can Sports & Fitness activities have points or scores?",
        "answer": "Yes, when a particular activity includes scoring, progress, or a friendly ranking."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "fog-arcade",
    "audience": "member",
    "icon": "🎮",
    "title": "FOG Arcade",
    "items": [
      {
        "question": "What is FOG Arcade?",
        "answer": "FOG Arcade is the Community Portal’s digital game area for fun games and eSports-style activities."
      },
      {
        "question": "Can I play an Arcade game again?",
        "answer": "Yes, when replay is available. After a game, you may see options to play again, return to the Arcade, save a score, or share your result."
      },
      {
        "question": "Do all Arcade games have a leaderboard?",
        "answer": "No. Only games that are connected to scoring or rankings will appear on a leaderboard."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "profile-member-directory",
    "audience": "member",
    "icon": "🪪",
    "title": "Profile & Member Directory",
    "items": [
      {
        "question": "What is my Profile?",
        "answer": "Your Profile is your personal member area. It may contain your basic information, photo, member details, and settings that are available for you to manage."
      },
      {
        "question": "What is the Member Directory?",
        "answer": "The Member Directory helps people in the community find member information that has been approved for sharing."
      },
      {
        "question": "Can everyone see all my information?",
        "answer": "No. The Portal should only show information that is appropriate for the person viewing it."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "sharing",
    "audience": "public",
    "icon": "↗",
    "title": "Sharing",
    "items": [
      {
        "question": "How do I share an event or game result?",
        "answer": "Tap the Share button when you see it. Your phone may open its normal sharing choices, or the Portal may let you copy a link."
      },
      {
        "question": "Does sharing a link give someone access to my account?",
        "answer": "No. A normal shared link should not include your password or private sign-in information."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "install-on-phone-offline-use",
    "audience": "public",
    "icon": "📱",
    "title": "Install on Phone & Offline Use",
    "items": [
      {
        "question": "How do I add the Community Portal to my phone?",
        "answer": "Open the Portal in your phone’s browser and use the browser’s option to add it to your Home Screen."
      },
      {
        "question": "Can I use the Portal without internet?",
        "answer": "Some parts may still be available when your connection drops, but anything that needs fresh information or saves a new change may need internet access."
      },
      {
        "question": "What should I do after reconnecting?",
        "answer": "Open the Portal again and allow it to reconnect normally. If something still looks outdated, refresh the page."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "leader-help-events-attendance-roles",
    "audience": "leader",
    "icon": "📋",
    "title": "Leader Help: Events, Attendance & Roles",
    "items": [
      {
        "question": "What can leaders manage for events?",
        "answer": "Depending on their permission, leaders may be able to help prepare event information, review registrations, check attendance, see turnout, and manage assigned roles."
      },
      {
        "question": "Why can’t I see an event-management choice?",
        "answer": "Some choices are shown only to leaders who have been given permission to use them."
      }
    ],
    "permissionAny": [
      "access_events",
      "access_attendance",
      "access_checkin"
    ],
    "permissionAll": []
  },
  {
    "id": "leader-help-ministries-availability",
    "audience": "leader",
    "icon": "🙌",
    "title": "Leader Help: Ministries & Availability",
    "items": [
      {
        "question": "What can ministry leaders manage?",
        "answer": "Depending on their permission, ministry leaders may be able to view membership, roles, service interest, and availability needed for ministry planning."
      },
      {
        "question": "Can every leader change every ministry?",
        "answer": "No. Access should follow the permission given to that leader."
      }
    ],
    "permissionAny": [
      "access_ministries"
    ],
    "permissionAll": []
  },
  {
    "id": "leader-help-announcements-broadcasts",
    "audience": "leader",
    "icon": "📣",
    "title": "Leader Help: Announcements & Broadcasts",
    "items": [
      {
        "question": "Who can send community announcements?",
        "answer": "Only people who have been given the right permission should be able to send announcements or broadcasts."
      },
      {
        "question": "What should I check before sending an announcement?",
        "answer": "Check the message, the people who should receive it, and whether the information is appropriate to share before you send it."
      }
    ],
    "permissionAny": [
      "access_communications"
    ],
    "permissionAll": []
  },
  {
    "id": "leader-help-worship-resources",
    "audience": "leader",
    "icon": "🎼",
    "title": "Leader Help: Worship Resources",
    "items": [
      {
        "question": "What can worship leaders manage?",
        "answer": "Depending on their permission, worship leaders may be able to prepare song resources, setlists, keys, tempo information, media, and chord references."
      },
      {
        "question": "Why are some worship choices hidden?",
        "answer": "Some choices are meant only for the people responsible for preparing or leading worship."
      }
    ],
    "permissionAny": [
      "access_worship"
    ],
    "permissionAll": []
  },
  {
    "id": "administrator-help-accounts-permissions",
    "audience": "admin",
    "icon": "⚙️",
    "title": "Administrator Help: Accounts & Permissions",
    "items": [
      {
        "question": "What are permissions?",
        "answer": "Permissions decide which special parts of the Community Portal a person is allowed to use."
      },
      {
        "question": "Why should permissions be given carefully?",
        "answer": "Some parts of the Portal can change member information, events, ministry information, or community messages. They should only be available to people who need them."
      },
      {
        "question": "Can hiding a button by itself protect an admin feature?",
        "answer": "No. The Portal must also check the person’s permission before allowing the action, even if someone tries to open the page or action directly."
      }
    ],
    "permissionAny": [
      "access_permissions"
    ],
    "permissionAll": []
  }
].map(section => Object.freeze({
    ...section,
    permissionAny: Object.freeze(section.permissionAny),
    permissionAll: Object.freeze(section.permissionAll),
    items: Object.freeze(section.items.map(item => Object.freeze(item)))
})));

const FAQ_PREVIEW_PROFILES = Object.freeze(new Set(["guest", "member", "leader", "administrator"]));

function isFaqSectionAllowed(section, access = {}) {
    const preview = access.preview || null;
    if (preview === "administrator") return true;
    if (preview === "leader") return section.audience !== "admin";
    if (preview === "member") return section.audience === "public" || section.audience === "member";
    if (preview === "guest") return section.audience === "public";

    if (section.audience === "public") return true;
    if (!access.authenticated) return false;
    if (section.audience === "member") return true;
    if (access.isAdministrator) return true;

    const hasPermission = typeof access.hasPermission === "function"
        ? access.hasPermission
        : () => false;
    if (section.permissionAny.length === 0 && section.permissionAll.length === 0) return false;
    const anySatisfied = section.permissionAny.length === 0 ||
        section.permissionAny.some(permission => hasPermission(permission));
    const allSatisfied = section.permissionAll.every(permission => hasPermission(permission));
    return anySatisfied && allSatisfied;
}

function getFaqSectionsForAccess(access = {}) {
    if (access.preview && !FAQ_PREVIEW_PROFILES.has(access.preview)) {
        throw new TypeError("Unknown FAQ preview profile");
    }
    return FAQ_SECTIONS
        .filter(section => isFaqSectionAllowed(section, access))
        .map(section => ({
            id: section.id,
            audience: section.audience,
            icon: section.icon,
            title: section.title,
            items: section.items.map(item => ({ ...item }))
        }));
}

module.exports = {
    FAQ_PREVIEW_PROFILES,
    FAQ_SECTIONS,
    getFaqSectionsForAccess,
    isFaqSectionAllowed
};
