# Farm Animal Activity Recognition: The Whole Project in Simple Words

This file explains the whole project without assuming any technical background. Read it top to bottom once and you should be able to explain the project to your supervisor, your examiners, or a farmer.

---

## Contents

1. [The project in one minute](#1-the-project-in-one-minute)
2. [The problem we are solving](#2-the-problem-we-are-solving)
3. [What the system does (what a user sees)](#3-what-the-system-does-what-a-user-sees)
4. [The big picture: how all the parts connect](#4-the-big-picture-how-all-the-parts-connect)
5. [The AI part: teaching a computer to recognise cow behaviour](#5-the-ai-part-teaching-a-computer-to-recognise-cow-behaviour)
6. [The dataset: CBVD-5](#6-the-dataset-cbvd-5)
7. [Preparing the data](#7-preparing-the-data)
8. [Training the model](#8-training-the-model)
9. [How good is the model? (Results explained)](#9-how-good-is-the-model-results-explained)
10. [The next improvement: two models instead of one](#10-the-next-improvement-two-models-instead-of-one)
11. [The software part: backend](#11-the-software-part-backend)
12. [The software part: frontend (the website)](#12-the-software-part-frontend-the-website)
13. [Alerts: how the system decides something is wrong](#13-alerts-how-the-system-decides-something-is-wrong)
14. [One full journey: what happens when you upload a photo](#14-one-full-journey-what-happens-when-you-upload-a-photo)
15. [Security: how we keep data safe](#15-security-how-we-keep-data-safe)
16. [Every tool we used and why](#16-every-tool-we-used-and-why)
17. [How to run the project](#17-how-to-run-the-project)
18. [How we tested it](#18-how-we-tested-it)
19. [Honest limitations and future work](#19-honest-limitations-and-future-work)
20. [Questions examiners may ask (with answers)](#20-questions-examiners-may-ask-with-answers)
21. [Glossary: hard words made easy](#21-glossary-hard-words-made-easy)

---

## 1. The project in one minute

> We built a website that watches cows through farm cameras (or uploaded photos and videos) and tells the farmer what each cow is doing. It recognises five behaviours: **standing, lying, foraging (eating), drinking and rumination (chewing the cud)**. It saves everything in a log, shows charts on a dashboard, and raises an alert when the herd behaves unusually, for example when cows have not drunk water for many hours.
>
> The "brain" of the system is an AI model called **YOLO11**. We trained it on a public research dataset of cow videos called **CBVD-5**.

If someone asks "what is your project?", say the paragraph above.

---

## 2. The problem we are solving

- On most farms in Pakistan, a person walks around the barn and **looks at the animals by eye** to check if they are healthy.
- This is **slow and tiring**, and it is **impossible to do 24 hours a day**.
- Small signs of illness are easy to miss. A sick cow often **lies down much more, eats less, or stops drinking**. If nobody notices early, the farmer loses milk, money, and sometimes the animal.

**Our idea:** a camera can watch all day without getting tired. If a computer can understand what each cow is doing, it can keep a record and warn the farmer when something looks wrong.

---

## 3. What the system does (what a user sees)

The system is a **website**. A user opens it in a browser such as Chrome.

| Page | What it is for |
|---|---|
| **Landing page** | The front page. It explains the product and has *Sign up* and *Log in* buttons. |
| **Sign up / Log in** | Create an account or enter with email and password. |
| **Workspace** | A "farm" inside the system. A user creates one, e.g. *Green Valley Dairy*, and becomes its **admin**. |
| **Dashboard** | The home screen: most cows seen together today, active alerts, cameras online, analyses run; today's behaviour split; "herd signals" (how much the herd is lying and eating, and when drinking, eating and chewing were last seen); a chart of the last 24 hours; recent alerts and the camera list. These numbers come from the **cameras only**, because an uploaded photo or video has no real "when it happened" time. |
| **Analyze** | Upload a **photo** and get it back with a box around every cow, its number and its behaviour (e.g. `#3 lying 0.82`). Or upload a **video**, which is processed in the background with a progress bar; the result has a **table per cow** (when it was in view, what it was mostly doing, how its time was split). |
| **Cameras** | Every camera is shown as a **card**. While a camera is monitoring, its card shows a small live picture (updated every second) with a *LIVE* tag; otherwise it says it is off, connecting, or what the error is. **Click a card** to watch that camera. Admins add cameras here: a USB webcam, a CCTV/IP camera, or a recorded video. |
| **Live view** | Opens when you click a camera card. Cameras are **off by default**, so opening one switches monitoring on. It shows smooth live video with every cow boxed, numbered and labelled, the cows in view right now, and totals since monitoring started. Here you can **Stop** or **Start** monitoring; admins can also **Edit** or **Delete** the camera. |
| **Activity logs** | A table of every detection (time, camera, cow number, behaviour, confidence). It can be filtered and downloaded as a CSV file for Excel. |
| **Alerts** | Warnings such as *"No drinking seen on Barn camera in the last 12 hours"*. Team members press **Acknowledge** once they have checked. Admins set the alert rules here. |
| **Animals** | A simple register of animals (tag number, name, breed, age, notes). |
| **Workspace settings** | A **"Get your workspace ready"** checklist for new farms (analyse a first photo, add a camera, invite the team), the farm name, invite team members with a link, choose their role (admin or member), and remove members. |
| **Profile** | Change your name or password. |

The pages use the **full width of the screen**, so on a big monitor the cards and charts spread out instead of leaving empty space at the sides. On a phone the left menu becomes a menu button.

### Colours used for behaviours

Each behaviour has its own colour everywhere (boxes on photos, charts, tables):

| Behaviour | Meaning | Colour |
|---|---|---|
| Standing | On its feet, not eating or drinking | Blue |
| Lying | Lying down and resting | Purple |
| Foraging | Eating at the feed area | Green |
| Drinking | Drinking at the water trough | Teal |
| Rumination | Chewing the cud (re-chewing food) | Brown/orange |

### Two roles

- **Admin:** can do everything: manage members, cameras, animals and alert rules.
- **Member:** can view everything, run analyses, start and stop cameras, and acknowledge alerts, but cannot change settings.

---

## 4. The big picture: how all the parts connect

The project has **three main parts**:

```
   ┌──────────────┐      ┌───────────────────────┐      ┌────────────────────┐
   │   FRONTEND   │ ───► │        BACKEND        │ ───► │   AI MODEL (YOLO11)│
   │  (website in │ ◄─── │ (server: the "brain"  │ ◄─── │  looks at a picture│
   │  the browser)│      │  that does the work)  │      │  and finds cows    │
   └──────────────┘      └──────────┬────────────┘      └────────────────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │    DATABASE     │
                           │ (saves users,   │
                           │ detections,     │
                           │ alerts, ...)    │
                           └─────────────────┘
```

**A simple way to picture it, a restaurant:**

- The **frontend** is the dining room and the menu: what the customer sees and touches.
- The **backend** is the kitchen: it receives orders, does the real work, and sends results back.
- The **AI model** is the expert chef in the kitchen who can look at a photo and say "this cow is drinking".
- The **database** is the storeroom and the record book where everything is kept.

The flow in one line:

```
Camera / Photo / Video → YOLO11 finds each cow + its behaviour → tracker gives each cow a number
      → saved in the database → shown on the dashboard → alert if something is unusual
      → (cameras) live video with boxes sent to the browser
```

---

## 5. The AI part: teaching a computer to recognise cow behaviour

### 5.1 What is "computer vision"?

Computer vision means **teaching a computer to understand pictures**. To a computer a photo is just millions of numbers (pixel colours). Computer vision turns those numbers into meaning, such as "there is a cow here and it is lying down".

### 5.2 What is "object detection"?

There are a few kinds of picture tasks:

- **Classification:** "What is in this photo?" → "a cow". One answer for the whole photo.
- **Object detection:** "**Where** is each object, and **what** is it?" → it draws a **box** around every cow and gives each box a label.

We need **object detection**, because one barn photo has **many cows** (about 8 on average in our dataset), each doing something different.

Each detection has:

1. a **box** (where the cow is),
2. a **label** (what it is doing, e.g. *drinking*),
3. a **confidence** score (how sure the model is, e.g. 0.84 = 84 %).

### 5.3 What is YOLO?

**YOLO = "You Only Look Once".** It is a very popular family of object-detection models.

- Older methods looked at a picture many times, piece by piece, which was slow.
- YOLO looks at the **whole picture once** and finds all objects in one go. That makes it **fast enough for live video**.

**YOLO11** is a recent version, made by a company called **Ultralytics**. It comes in sizes: *n* (nano), *s* (small), *m* (medium), *l* (large), *x* (extra large). Bigger is a bit more accurate but slower.

**We used YOLO11s (small).** It is a good balance:

- about **9.4 million** internal numbers (parameters),
- fast: about **5 milliseconds per image** on a GPU, and about **16 images per second on a normal laptop CPU**,
- small enough to train for free on Kaggle.

### 5.4 What is a "neural network" and "training"?

A **neural network** is a large mathematical function with millions of adjustable numbers (called **weights**). At the start, these numbers are random and the model's answers are wrong.

**Training** means showing the model thousands of example pictures *with the correct answers* (boxes and labels drawn by humans). After each example, the model compares its guess with the correct answer and slightly adjusts its numbers to be less wrong next time. After many rounds, it becomes good at the task.

**Analogy:** a student solving past papers. They attempt a question, check the answer key, learn from the mistake, and improve.

### 5.5 What is "transfer learning" / "fine-tuning"?

We did **not** train from zero. We started from a YOLO11s model that was **already trained on COCO**, a huge public dataset of everyday objects (people, cars, dogs, and also cows). This model already knows how to "see" shapes, edges, and animals.

We then **fine-tuned** it: we continued training on our cow-behaviour pictures so it learns our **5 behaviours**.

**Analogy:** hiring an experienced doctor and giving them a short course in a new specialty, instead of training a child from the beginning. It is faster and needs less data.

---

## 6. The dataset: CBVD-5

### 6.1 What is it?

**CBVD-5** stands for **Cattle Behaviour Video Dataset with 5 behaviours**. It is a **public research dataset** published with a scientific paper in *Scientific Reports* (2024). We downloaded it from **Kaggle** (dataset name `cbvd-5cow-behavior-video-dataset`).

What it contains:

- Videos recorded by **cameras inside a real dairy-cow barn**.
- **687 short clips**, each **10 seconds** long, with about **107 different cows**.
- From each clip, some frames (single pictures) were **labelled by humans**: they drew a box around each cow and wrote what it was doing.
- The **5 behaviours**: standing, lying down, foraging, drinking water, rumination.

### 6.2 Why did we use a public dataset instead of making our own?

- Labelling thousands of pictures by hand (drawing a box around every cow, in every frame) takes **months of work**.
- CBVD-5 was made by researchers, so the labels are of good quality and the results can be **compared with published work**.
- It already has exactly the behaviours that matter for cow health.

(Our original proposal said "custom dataset". Using a public research dataset is normal and is a stronger, more checkable choice. A small custom dataset from a local farm could be added later for testing.)

### 6.3 Numbers we actually used

After cleaning (explained in the next section):

| Item | Count |
|---|---|
| Video clips with labels | 537 |
| Labelled pictures (keyframes) | **3,199** |
| Cow boxes (labelled cows) | **25,320** |
| Average cows per picture | about 8 (maximum 24) |

How many boxes of each behaviour (after the "one label per cow" rule, explained below):

| Behaviour | Boxes |
|---|---|
| Standing | 8,272 |
| Foraging | 5,711 |
| Rumination | 6,079 |
| Lying | 4,518 |
| Drinking | 744 (rare) |

Notice that **drinking is rare**. Cows drink only a few times a day, so there are few examples. This makes drinking harder for the model to learn. This is called **class imbalance**.

---

## 7. Preparing the data

All of this is done in the notebook **`Notebook/Notebook.ipynb`**, which runs on Kaggle.

### Step 1: Read the labels

The dataset stores labels in a research format called **AVA format** (a table, one row per cow per behaviour):

```
video_id, time_in_seconds, x1, y1, x2, y2, action_id, cow_id
393,      4,               0.33, 0.23, 0.41, 0.36, 2, 1
```

- `x1, y1` = top-left corner of the box, `x2, y2` = bottom-right corner.
- The coordinates are **between 0 and 1** (a fraction of the picture width/height), so they work for any picture size.
- `action_id` is the behaviour number: 1 = stand, 2 = lying, 3 = foraging, 4 = drinking, 5 = rumination.

### Step 2: Convert to YOLO format

YOLO needs a different format: one small text file per picture, one line per cow:

```
class_number  centre_x  centre_y  width  height
1             0.37      0.30      0.09   0.14
```

The notebook converts every box automatically.

### Step 3: One cow can have two behaviours, so pick one

In real life a cow can do two things at once: **lying + ruminating**, or **standing + eating**. The dataset sometimes gives one cow two labels. Standard YOLO allows **only one label per box**.

So we used a **priority rule**: the more important "activity" wins over the body position:

```
drinking  >  foraging  >  rumination  >  lying  >  standing
```

Example: a cow that is *lying + ruminating* becomes **rumination**. A cow that is only *lying* stays **lying**.

Why this order? If posture (standing/lying) won, the activities (eating, drinking, chewing) would almost disappear, because every cow is always either standing or lying.

### Step 4: Remove broken labels

A few boxes in the dataset had impossible coordinates (outside the picture). We removed them: **2 broken boxes** and **2 tiny boxes** out of 25,324.

### Step 5: Split into train / validation / test **by video**

We divided the data into three groups:

| Group | Share | Used for |
|---|---|---|
| **Train** | 70 % (2,278 pictures, 382 videos) | The model learns from these. |
| **Validation** | 15 % (480 pictures, 81 videos) | Checked during training to pick the best version. |
| **Test** | 15 % (441 pictures, 74 videos) | Used **once at the end** to give the final, honest score. |

**Important: we split by video, not by picture.**
Pictures from the same 10-second clip look almost identical. If one frame were in training and the next frame in testing, the model would have "already seen the answer". That would give a fake high score. This mistake is called **data leakage**.

**Analogy:** if the exam paper has the same questions as the practice paper, a high mark doesn't prove the student learned anything.

We also kept the share of each behaviour similar in all three groups (this is called **stratified** splitting), so rare drinking examples appear in every group.

---

## 8. Training the model

### Where and with what

- **Kaggle Notebooks**: a free online service with free GPUs.
- **GPU: NVIDIA Tesla T4**. A GPU is a graphics card that does many maths operations at the same time, which makes training much faster than on a normal CPU.
- **Ultralytics** library (Python) with **PyTorch** underneath.

### Main settings (explained)

| Setting | Value | Meaning |
|---|---|---|
| Model | YOLO11s | Small version, pre-trained on COCO |
| Image size | 640 pixels | Each picture is resized to 640 px before going in |
| Batch size | 16 | The model looks at 16 pictures, then updates itself |
| Epochs (max) | 100 | One epoch = the model has seen every training picture once |
| Early stopping | patience 25 | Stop if there is no improvement for 25 epochs in a row |
| Learning rate schedule | cosine | Learn in big steps at first, smaller careful steps later |
| Mixed precision (AMP) | on | Uses lighter numbers to train faster on the GPU |

### Data augmentation (making more variety for free)

During training the pictures are changed slightly each time, so the model doesn't just memorise them:

- **Horizontal flip** (mirror image): a cow facing left becomes a cow facing right. We did **not** flip upside down, because cows are never upside down.
- **Mosaic**: four pictures are joined into one, so the model sees cows in different positions and sizes. This is turned off for the last 10 epochs so the model finishes on normal pictures.
- **Colour and brightness changes**, **small zoom/shift**: to handle different lighting in the barn.

### What happened

- Training **stopped automatically at epoch 68**, because the best result came at **epoch 43** and there was no improvement for 25 epochs after that.
- Total time: about **41 minutes**.
- The best version was saved as **`best.pt`**. This single file (about 19 MB) is our trained model. It is stored in `Notebook/model/best.pt` and copied to `backend/models/best.pt` for the website.

---

## 9. How good is the model? (Results explained)

### 9.1 The scores in simple words

| Score | Simple meaning | Analogy |
|---|---|---|
| **Precision** | When the model says "drinking", how often is it **right**? | Of all the people a guard stops, how many were actually thieves? |
| **Recall** | Out of all cows that really were drinking, how many did the model **find**? | Of all the real thieves, how many did the guard catch? |
| **F1 score** | One number that balances precision and recall | The average of "being right" and "not missing" |
| **IoU** | How much the model's box **overlaps** the true box (0 to 1) | How well two stickers placed on a cow cover each other |
| **mAP50** | Overall accuracy score, where a box counts as correct if it overlaps the true box by at least 50 % | The main exam result for detection |
| **mAP50-95** | The same score, but stricter: it also checks how *exact* the box is (overlap from 50 % to 95 %) | The exam marked very strictly |

All scores go from 0 to 1 (or 0 % to 100 %). Higher is better.

### 9.2 Our final results (test set: pictures the model never saw)

| Behaviour | mAP50 | mAP50-95 | F1 |
|---|---|---|---|
| Standing | 0.672 | 0.313 | 0.691 |
| Lying | 0.474 | 0.215 | 0.476 |
| Foraging | **0.855** | **0.564** | **0.833** |
| Drinking | 0.605 | 0.277 | 0.585 |
| Rumination | 0.566 | 0.300 | 0.601 |
| **Overall** | **0.635** | **0.334** | **0.641** |

On the validation set the overall mAP50 was **0.685**.

**How to say it in plain words:**
> "On new videos the model has never seen, it correctly finds and labels cows about 64 % of the time overall. It is best at recognising **eating (about 85 %)** and weakest at telling **lying** apart from **rumination**."

### 9.3 Why are lying and rumination confused?

- **Rumination means chewing**, which is a **movement of the jaw over time**. A single still photo cannot show movement.
- A cow lying quietly and a cow lying while chewing look **almost the same in one picture**.
- Because of our priority rule, "lying + chewing" is labelled *rumination* and "lying only" is labelled *lying*, so the model has to guess between two very similar pictures.

The **confusion matrix** (a table of "true behaviour vs predicted behaviour") shows exactly this: many real *lying* cows were predicted as *rumination*, and the other way round.

The researchers who made CBVD-5 also found rumination and drinking to be the hardest behaviours, even with a video model. So this is a **known, honest limitation**, not a bug.

### 9.4 Real test on a barn picture

When we gave the website a real barn frame with two cows, it found both: one **standing (84 % confidence)** and one **ruminating (77 % confidence)**, matching the human labels.

---

## 10. The next improvement: two models instead of one

The core issue is that a cow has a **posture** *and* an **activity** at the same time (e.g. lying + ruminating), but one YOLO box can only have one label.

**Planned solution ("dual mode"):**

- **Model 1, posture:** standing or lying (every cow has one).
- **Model 2, state/activity:** foraging, drinking or rumination (only when the cow is doing one).
- The system runs both models on the same picture and **joins the results** for each cow by checking which boxes overlap (IoU ≥ 50 %).
- Result per cow: e.g. **posture = lying, state = rumination**.

The website **already supports this**. One setting changes it: `MODEL_MODE=dual` in the settings file. Only the two new models still need to be trained.

---

## 11. The software part: backend

The **backend** is the server program. It runs on a computer, receives requests from the website, does the work, and sends back answers.

### 11.1 Main technologies

| Technology | What it is | Why we used it |
|---|---|---|
| **Python** | Programming language | The AI (YOLO) is in Python, so everything stays in one language |
| **FastAPI** | A Python framework for building **APIs** | Fast, modern, checks data automatically, and creates documentation pages by itself |
| **Uvicorn** | The program that runs FastAPI | Handles the web requests |
| **SQLite** | A database stored in **one file** (`farm.db`) | No separate database server needed; easy for a project |
| **SQLAlchemy** | A tool to talk to the database using Python instead of raw SQL | Cleaner, safer code |
| **Pydantic** | Checks that incoming data is valid | E.g. rejects an email without "@", or a password shorter than 8 characters |
| **Ultralytics + PyTorch** | Runs the YOLO11 model | Same library used for training |
| **OpenCV** | Reads images, videos and camera streams; draws boxes | Industry-standard computer-vision library |
| **NumPy + SciPy** | Maths on pictures and boxes; SciPy has the **Hungarian algorithm** | Used by the cow tracker (section 11.5) |
| **WebSocket** | A connection between browser and server that stays open | Sends the live camera video to the browser without asking again for every picture |
| **bcrypt** | Scrambles passwords safely | So real passwords are never stored |
| **PyJWT** | Creates login tokens | Keeps users logged in securely |

### 11.2 What is an API?

An **API** is a list of "doors" the website can knock on to ask the server for something. Each door has an address, for example:

- `POST /api/auth/login`: "log me in"
- `POST /api/workspaces/1/analyze/image`: "here is a photo, analyse it"
- `GET /api/workspaces/1/dashboard/summary`: "give me the dashboard numbers"

**Analogy:** a waiter. The customer (website) gives an order to the waiter (API), the kitchen (backend) prepares it, and the waiter brings back the food (data).

When the backend is running, all doors are listed automatically at **http://127.0.0.1:8000/docs**.

### 11.3 The database: what we store

Think of the database as an **Excel file with several sheets (tables)**:

| Table | What it stores |
|---|---|
| `users` | Name, email, scrambled password |
| `workspaces` | Each farm/team |
| `workspace_members` | Who belongs to which workspace, and their role (admin/member) |
| `invites` | Invite links (email, role, secret token, expiry after 7 days) |
| `cameras` | Camera name, type (webcam / stream / recorded video), source (webcam number, stream address, video link or uploaded file), location, on/off |
| `animals` | Tag ID, name, breed, age, notes |
| `analyses` | Each upload or camera session: type, status (queued / processing / done / failed), progress |
| `detections` | **Every cow found**: time, cow ID, behaviour, posture, state, confidence, box position |
| `alert_rules` | Rules like "alert if lying > 70 % for 1 hour" |
| `alerts` | Alerts that were raised, and who acknowledged them |

Every piece of data belongs to a **workspace**. The system always checks that you are a member of that workspace before showing anything, so one farm can never see another farm's data.

### 11.4 Work that runs in the background

Some jobs take a long time, so they run **in the background** while the website stays responsive:

- **Video worker:** an uploaded video is processed at **1 frame per second** (a 10-minute video → 600 pictures checked). The progress bar updates while it works. If the server restarts, unfinished videos are started again automatically.
- **Camera workers:** each running camera gets its **own worker**. One part reads the camera at full speed; another part runs the AI on the newest picture (once a second normally, up to 8 times a second while someone watches the live view), tracks the cows, and saves **one record per cow per second**. If the camera disconnects, it tries again every 5 seconds.
- Cameras that were on when the server stopped are **switched on again** when it starts.
- The model is **loaded once at startup** (not on every request), and only one picture goes through it at a time so the workers don't interfere with each other.

### 11.5 Cow IDs: following each cow over time (tracking)

The model looks at **one picture at a time**. On its own it cannot tell that the cow in this second's frame is the same cow as one second ago. So we added a **tracker** that gives every cow a number (**#1, #2, #3 …**) and keeps that number while the cow stays in view. No extra model or training was needed.

How it works, step by step:

1. **Match by overlap.** A cow moves only a little in one second, so its new box overlaps its old box a lot. We measure the overlap (IoU) between every old cow and every new box.
2. **Best one-to-one matching.** The **Hungarian algorithm** (a classic method for "who goes with whom" problems) pairs old cows with new boxes so the total overlap is as high as possible, and no box gets two cows.
3. **Second chance by distance.** When a cow stands up or lies down, its box changes shape and the overlap drops. Boxes that are left over are matched by how close their centres are. (Professional trackers like ByteTrack also use two matching passes.)
4. **New cow or lost cow.** A box with no match is a new cow and gets the next number. A cow that is missing for a few seconds (e.g. hidden behind another cow) keeps its number; after that it is dropped.
5. **Smoothing the labels.** Each cow's behaviour is the **most common label over its last 5 frames**. If the model wrongly says "standing" for one frame in the middle of a long lie-down, the cow still shows as lying.
6. **Ignoring flicker.** Sometimes the model sees a "cow" for just one frame. A cow only counts in the summaries after it was tracked in at least 3 frames.

What the user gets: in a video result, a **table per cow** (when it was in view, what it was mostly doing, and a coloured bar showing how its time was split), and a link to all detections of that cow. The cow number is also drawn on each box and shown in the activity log and CSV export.

**Honest limit:** a number is not an identity. If a cow leaves the camera view and comes back, it gets a new number. Recognising the *same* cow across days needs re-identification (future work).

### 11.6 Supported cameras

- **USB webcam / laptop camera**: enter its number, e.g. `0`.
- **CCTV / IP camera**: enter its stream address, usually **RTSP**, e.g. `rtsp://user:password@192.168.1.20/stream` (RTMP and HTTP(S) streams work too). (RTSP is the standard way CCTV cameras send live video over a network.)
- **Recorded video**: a direct link to a video file (e.g. `https://example.com/barn.mp4`) or a video uploaded from the computer. The system plays it **at normal speed and starts again at the end**, so it behaves exactly like a live camera: the dashboard, alerts and activity log all work. This is how we demo live monitoring without a real barn camera. (A YouTube link is a web page, not a video file, so the system refuses it and says why.)

**Watching a camera live.** The Cameras page shows every camera as a **card** with a small live picture while it is monitoring. The card picture is a **snapshot** (the newest picture with the boxes drawn on it) fetched once a second, which is light enough to show many cameras at once. Cameras are **off by default**; clicking a card opens that camera's **Live view** page and switches monitoring on. The camera keeps monitoring after you leave the page (so alerts and the activity log keep working) until someone presses **Stop**. The Live view page shows **smooth video** (as fast as the camera films, up to 30 pictures a second) with a box around every cow, the cow's number and its behaviour, e.g. `#3 lying 0.82`. Next to it is the list of cows in view right now, and totals since monitoring started.

How it stays smooth, in simple words:
- One part of the program **only reads the camera** and always keeps just the newest picture.
- Another part **runs the AI on the newest picture** as often as the computer can (up to 8 times a second while someone watches). On a slow computer the boxes update less often, but the video never stutters or falls behind.
- The video goes to the browser over a **WebSocket** (a connection that stays open), and the browser paints each picture straight onto the screen.
- The database still gets one record per cow per second, so watching does not fill the disk faster.

On our test computer the live view ran at the video's full **25 frames per second**, with the boxes refreshed about 7 times a second.

### 11.7 What happens when something goes wrong

A farm system must keep working when things fail, and tell people clearly what is wrong. We planned for each failure:

| Failure | What the system does |
|---|---|
| Camera unplugged, network drops, video link down | The camera shows **Error** with the reason and **tries again every 5 seconds** by itself |
| Database busy for a moment | The worker tries again; the website says "busy, try again" instead of crashing |
| Someone uploads a broken or wrong file | Refused straight away with a helpful message; nothing is saved |
| Disk full | A clear message; half-written files are deleted |
| A bug in the server | The user sees a short **reference code**; the same code is in the log file with full details, so the developer finds the exact error |
| Server is stopped in the middle of a video | It stops at once; the video **continues automatically** next time the server starts |
| The model file is missing | The website still opens and shows a banner explaining the problem |
| A wrong value in the settings file | The server stops at once with a message naming the wrong setting |
| Server stopped while cameras were running | Their old sessions are closed and monitoring starts again automatically |
| Live view loses its connection (Wi-Fi, server restart) | The page says so and **reconnects by itself** |
| Slow computer or slow internet | Old pictures are skipped, never queued, so the live view never falls behind |
| The backend is not running | The website says *"Cannot reach the backend server"* instead of a confusing error |
| A page crashes in the browser | A recovery screen with a **Reload page** button instead of a blank page |

To set up a new computer we wrote a **setup checker** (`python backend/doctor.py`). It checks everything the system needs (Python, packages, settings, folders, database, the model, video support, Node.js, free ports) and prints how to fix anything missing. The one-click start (`run.bat`) runs it automatically. All warnings and errors are also written to a **log file** (`backend/logs/app.log`), and the address **http://127.0.0.1:8000/api/health** shows at a glance whether the model, database, cameras and disk are fine.

---

## 12. The software part: frontend (the website)

The **frontend** is everything the user sees in the browser.

| Technology | What it is | Why we used it |
|---|---|---|
| **React** | A popular library for building interactive web pages from reusable pieces ("components") | Industry standard; each part (button, table, chart) is written once and reused |
| **TypeScript** | JavaScript with **types** (it checks that data has the right shape) | Catches mistakes before the site runs |
| **Vite** | The tool that runs the website during development and builds it for release | Very fast; also forwards `/api` requests to the backend |
| **Tailwind CSS** | A styling system (colours, spacing, fonts) | Fast, consistent design |
| **React Router** | Moves between pages without reloading | Smooth navigation |
| **Recharts** | Chart library | Dashboard 24-hour activity chart |
| **Canvas + WebSocket** | Browser drawing area fed by an always-open connection | Paints the live camera video smoothly, picture by picture |
| **Lucide** | Clean outline icons | Simple, professional icons |
| **Inter** | The font | Clear, modern, easy to read |

### Design rules we followed

- Clean and professional: **flat colours**, no gradients, no "glowing" effects.
- Main colour: **dark green `#1F6F4A`** (farm/nature feel).
- **Accessible:** text colours pass the international contrast standard (WCAG 4.5 : 1), every input has a label, and you can use the site with the keyboard.
- **Responsive:** works on phones. The left menu turns into a menu button on small screens.
- **Full width:** content fills the screen beside the menu; big screens show more cards per row instead of empty space.
- **Click to open:** cameras are cards you click, not rows full of buttons.
- Every page has proper **loading**, **empty** ("nothing here yet") and **error** messages.

---

## 13. Alerts: how the system decides something is wrong

Alerts work at **herd level**, per camera. They look at **all cows seen by one camera** over a time window, not at one specific cow. (Cows are tracked with IDs, see 11.5, but alerts per cow are future work.)

### The three rules

| Rule | Example setting | Why it matters |
|---|---|---|
| **Too much lying** | Alert if ≥ 70 % of cow detections are *lying* over 1 hour | Sick, lame or stressed cows lie down more |
| **No foraging** | Alert if no eating is seen for 6 hours | Loss of appetite is an early sign of illness |
| **No drinking** | Alert if no drinking is seen for 12 hours (marked **High**) | Water is critical, especially in Pakistan's heat |

Every new workspace starts with these three rules. Admins can change the numbers, turn rules on/off, or add more.

### Protection against false alarms

AI models are not perfect, so we added safety checks:

1. A rule is only checked when the camera has been watching for the **whole time window** (no alert 5 minutes after switching on).
2. There must be at least **30 cow detections** in the window, i.e. cows must actually be visible. An empty barn or a dark night shouldn't cause alarms.
3. For "no eating/drinking", the behaviour counts as "seen" only after **3 confident detections (≥ 50 %)**, so one lucky guess does not cancel a real problem.
4. **No duplicate alerts:** if an alert is already open for that rule and camera, or one was raised within the same time window, no new one is created.

Rules are checked **every minute** for every running camera.

---

## 14. One full journey: what happens when you upload a photo

1. You open **Analyze**, choose a barn photo and press **Analyze image**.
2. The **frontend** sends the photo to the backend address `/api/workspaces/1/analyze/image`.
3. The **backend** checks:
   - Are you logged in?
   - Are you a member of workspace 1?
   - Is the file really an image, and smaller than 200 MB?
4. The photo is saved in the `uploads` folder.
5. The photo goes into **YOLO11**. In a fraction of a second it returns, for each cow: a box, a behaviour and a confidence.
   - Only detections with confidence **≥ 35 %** are kept (to ignore weak guesses).
6. The cows are numbered **#1, #2, …** from left to right, and **OpenCV** draws coloured boxes with the number and behaviour on a copy of the photo.
7. Every detection is saved in the **database** (`detections` table).
8. The backend sends back the result. The **frontend** shows the annotated photo, the number of cows, and a table of detections.
9. The detections now also appear in **Activity logs**. (They do **not** change the Dashboard: an uploaded photo has no real "when it happened" time, so the Dashboard shows camera data only.)

For a **camera**, steps 5–7 repeat automatically (the tracker keeps each cow's number from second to second), the results feed the Dashboard, and the alert rules are checked every minute.

---

## 15. Security: how we keep data safe

| Protection | Simple explanation |
|---|---|
| **Password hashing (bcrypt)** | Passwords are put through a one-way "blender". We store only the blended result, so even we cannot read your password. At login, we blend what you type and compare. |
| **Login token in a secure cookie (JWT)** | After login, the browser gets a signed "wristband" (like at an event) that proves who you are. The browser's JavaScript cannot read it (*httpOnly*), and other websites cannot use it (*SameSite*). It expires after 24 hours. |
| **Workspace checks on every request** | Before showing any data, the server checks that you are a member of that farm. Changing a number in the address bar doesn't reveal other farms' data. |
| **Roles** | Only admins can change settings, cameras, animals, rules and members. |
| **Safe invites** | An invite link works only for the email it was sent to and expires after 7 days. A workspace can never lose its last admin. |
| **Hidden camera passwords** | Camera addresses like `rtsp://user:password@…` are shown as `rtsp://***@…` to normal members. |
| **Upload checks** | Only allowed file types (images/videos) and a size limit of 200 MB. |
| **Secret key required** | The server refuses to start without a proper secret key in its settings file. |

---

## 16. Every tool we used and why

| Area | Tool | One-line reason |
|---|---|---|
| AI model | **YOLO11s (Ultralytics)** | Fast, accurate, modern object detector |
| AI framework | **PyTorch** | The engine that runs neural networks |
| Training platform | **Kaggle** (free Tesla T4 GPU) | Free GPU for training |
| Dataset | **CBVD-5** (Scientific Reports, 2024) | Public, research-quality cow behaviour labels |
| Data handling | **pandas, NumPy, scikit-learn** | Reading tables, maths, fair data splitting |
| Images & video | **OpenCV** | Read photos/videos/cameras, draw boxes |
| Tracking | **SciPy** (Hungarian algorithm) | Match each cow to its box in the next frame |
| Live video | **WebSocket** | Stream the camera to the browser smoothly |
| Backend | **FastAPI + Uvicorn** (Python) | Fast, modern web server |
| Database | **SQLite + SQLAlchemy** | Simple one-file database |
| Data checks | **Pydantic** | Rejects bad input automatically |
| Security | **bcrypt, PyJWT** | Safe passwords and logins |
| Frontend | **React + TypeScript + Vite** | Modern, reliable website |
| Styling | **Tailwind CSS**, **Inter** font, **Lucide** icons | Clean, consistent look |
| Charts | **Recharts** | Dashboard charts |
| Testing | **pytest**, **Playwright** | Automatic tests for server and browser |
| Editor | **VS Code** | Writing the code |

---

## 17. How to run the project

**What you need on the computer:** Python 3.10 or newer, and Node.js 22 LTS (20.19+ also works).

**Easiest way (Windows):** double-click **`run.bat`** in the project folder.
It will:

1. find a working Python 3.10+ (it skips the Microsoft Store placeholder),
2. install all Python packages with `pip` (the first time this downloads PyTorch, which is large),
3. create the settings file `backend/.env` with a random secret key,
4. copy the trained model to `backend/models/best.pt`,
5. install the website packages with `npm`,
6. run the **setup checker** (`doctor.py`) and stop with clear instructions if something is wrong,
7. open **two windows** (Backend and Frontend) and then open the browser.

On Git Bash / Linux / Mac use **`./run.sh`** instead.

Then go to **http://localhost:5173**, sign up, create a workspace, and try **Analyze** with a barn photo.

**For a presentation (demo data):** a brand-new workspace has an empty dashboard. To show a "real" farm, run this once in the `backend` folder:

```
python seed_demo.py
```

Then log in with **demo@farm.local** / **demo12345**. The demo farm *Green Valley Dairy* has 3 cameras, 8 animals, 2 open alerts and 24 hours of herd activity that follows a normal day (eating in the morning and evening, resting and chewing at night). Be honest if asked: this activity is **generated sample data** to show the dashboard. The real AI result is shown on the **Analyze** page when you upload a barn photo.

| Address | What it is |
|---|---|
| http://localhost:5173 | The website |
| http://127.0.0.1:8000/docs | The backend's automatic API documentation |
| http://127.0.0.1:8000/api/health | Quick health check: model, database, cameras, disk |

**To show live monitoring without a real camera:** go to **Cameras → Add camera**, choose **Recorded video**, and upload a barn video. Then click its card: monitoring starts and the live view plays the video in a loop with every cow boxed and numbered.

**If something doesn't start:** run `python backend/doctor.py` and follow what it says, or look in `backend/logs/app.log`.

---

## 18. How we tested it

- **47 automatic backend tests** (pytest). They check:
  - sign up, log in, wrong password, duplicate email;
  - one farm cannot see another farm's data;
  - members cannot do admin actions;
  - the invite link works only for the right email;
  - the last admin cannot be removed;
  - real image analysis with the trained model;
  - video processing in the background;
  - alert rules fire once and don't repeat;
  - CSV export and dashboard numbers (uploads don't count as live farm activity);
  - tracking: cows keep their IDs while moving, a hidden cow keeps its ID for a few frames, one wrong label is smoothed away, flicker tracks don't count as cows;
  - an older database gets the new cow-ID column automatically;
  - cameras: each camera type is validated (YouTube links refused), a recorded video plays and loops, an uploaded or linked video runs as a live camera, an unreachable camera reports the error and keeps retrying, uploaded files are cleaned up;
  - live view: no picture while stopped; while running, a smooth stream (20+ frames in a few seconds), boxes refreshed faster than once a second, session totals, and no access when logged out or from another farm;
  - a recorded video waits for each frame's moment (plays at real speed), and tracking measures time, not number of frames;
  - errors: a server bug returns a reference code, a busy database returns "try again", a wrong setting gives a readable message, and the health check reports every part.
- **Browser test (Playwright)**: a robot clicked through the whole website like a real user, on desktop and phone sizes. It covered: sign up → create workspace → analyse a real barn photo → add/start/stop a camera → add an animal → alerts → activity log and CSV download → invite a team member → the member joins and sees only member actions. There were no errors.
- **Code checks:** TypeScript type-checking and ESLint (a code-quality checker) pass with zero problems.

---

## 19. Honest limitations and future work

Being honest about limits is a strength in a viva. Say these clearly:

| Limitation | Why | Future fix |
|---|---|---|
| Lying and rumination are often confused | Chewing is movement; one photo can't show movement | Two-model approach (posture + activity), and later a **video model** that looks at several frames |
| Drinking is less accurate | Few drinking examples (class imbalance) | Collect more drinking examples; use extra weighting for rare classes |
| Cow IDs reset when a cow leaves the view | Tracking follows a cow only while it stays in view | **Re-identification** by coat pattern, so a cow keeps its ID across cameras and days |
| All training data is from one barn | The dataset comes from one farm and its cameras | Test and fine-tune on footage from local Pakistani farms |
| "Cows detected today" is the **largest number of cows in one frame**, not a unique count | Track IDs restart when a cow comes back, so counting IDs would overcount | Re-identification (as above) |
| No SMS/email alerts yet | Kept out of this version | Add SMS (e.g. Twilio) and email |
| SQLite database grows quickly with many cameras | About one row per cow per second | Summarise old data, or move to PostgreSQL for big farms |
| Opening a camera's live view switches monitoring on, and it stays on until someone presses Stop | Monitoring must keep running for alerts to work | A schedule (e.g. monitor only at night) or auto-stop for cameras nobody needs |
| One server process | Cameras run as threads inside the API server, which is enough for one farm | Move camera workers to separate processes or machines for many cameras |

---

## 20. Questions examiners may ask (with answers)

**Q1. Why YOLO and not another model?**
YOLO looks at the whole image once, so it is fast enough for live cameras, and it detects many cows in one picture. YOLO11 is a recent, well-supported version and is easy to train with the Ultralytics library.

**Q2. Why YOLO11s and not a bigger model?**
It balances speed and accuracy. It runs at about 16 frames per second even on a normal laptop CPU, and it trains in under an hour on a free GPU. A bigger model (YOLO11m) is a possible future experiment.

**Q3. Which dataset did you use and how big is it?**
CBVD-5, a public cattle behaviour dataset published in *Scientific Reports* (2024). We used 3,199 labelled pictures from 537 videos, with 25,320 labelled cows and 5 behaviours.

**Q4. How did you split the data, and why that way?**
70 % train, 15 % validation, 15 % test, **split by video** so frames of the same clip never appear in both training and testing. Otherwise the test score would be falsely high (data leakage).

**Q5. What is your accuracy?**
On the unseen test set: overall **mAP50 = 0.635**, **F1 = 0.64**. Foraging is best (0.855), lying is weakest (0.474).

**Q6. What does mAP mean?**
Mean Average Precision: it combines how often the model is right (precision) and how many cows it finds (recall), averaged over all behaviours. "50" means a box counts as correct if it overlaps the true box by at least 50 %.

**Q7. Why is lying confused with rumination?**
Rumination is jaw movement over time; a single picture can't show it, so a lying cow and a lying-and-chewing cow look the same. Our planned fix is two separate models (posture + activity), and later a video-based model.

**Q8. What is transfer learning and did you use it?**
Yes. We started from a YOLO11s model already trained on the COCO dataset (general objects) and fine-tuned it on cow behaviours. This needs less data and less time than training from scratch.

**Q9. What is early stopping?**
Training stops automatically when the validation score stops improving. Ours stopped at epoch 68; the best model was from epoch 43. This prevents **overfitting** (memorising the training pictures instead of learning).

**Q10. What is data augmentation?**
Making small random changes to training pictures (mirror flip, brightness change, joining four pictures into one) so the model sees more variety and generalises better.

**Q11. How does the alert system avoid false alarms?**
It needs the camera to watch the whole time window, at least 30 cow detections, at least 3 confident detections before a behaviour counts as "seen", and it never repeats an alert that is already open.

**Q12. How do you keep data secure?**
Passwords are hashed with bcrypt; login uses a signed token in an httpOnly cookie; every request checks workspace membership and role; invite links only work for the invited email; camera passwords are hidden from members.

**Q13. Why FastAPI + SQLite + React? (The SRS mentioned Django/MySQL.)**
FastAPI is lighter and faster for an AI-serving API and fits naturally with the Python model. SQLite needs no separate database server, which suits a single-farm deployment and a student project. The data layer uses SQLAlchemy, so switching to MySQL or PostgreSQL later needs only a settings change. React gives a modern, responsive dashboard. *(Tip: update the SRS to match, or mention this decision to your supervisor.)*

**Q14. Can it identify individual cows?**
It **tracks** each cow while it is in view: every cow gets a number (#1, #2, …) that stays the same from frame to frame, so we can say "cow #3 was ruminating from 0:05 to 0:47". It does not know *which* cow it is (its name or tag), and a cow that leaves the view and comes back gets a new number. Knowing the actual cow needs re-identification, which is future work. See section 11.5 for how tracking works.

**Q15. How fast is it?**
About 5 ms per image on a GPU and about 60 ms per frame (≈ 16 fps) on a normal laptop CPU. A camera nobody is watching is analysed once per second, so one ordinary computer can handle several cameras; while someone watches the live view, the boxes refresh up to 8 times a second (about 7 on our test laptop) and the video runs at full speed (25 fps).

**Q16. What happens if the camera disconnects?**
The camera's card on the Cameras page shows "Error" with the reason, and the system keeps trying to reconnect every 5 seconds automatically. If the *viewer's* connection drops instead, the live view page says so and reconnects by itself.

**Q17. How does the live view stay smooth on a normal laptop?**
Reading the camera and running the AI are two separate jobs. The reader keeps only the newest picture and sends it to the browser at the camera's own speed (up to 30 pictures a second). The AI updates the boxes as often as the computer can (up to 8 times a second). On a slow computer the boxes refresh less often, but the video itself never stutters or lags behind.

**Q18. How do I watch a camera?**
Open **Cameras** and click the camera's card. If it was off, monitoring switches on automatically and the live video appears. Press **Stop monitoring** on that page to switch it off.

**Q19. How would you find a bug that a user reports?**
Every error message the user sees has a short **reference code**. The same code is written in `backend/logs/app.log` next to the full technical details, so we can find the exact problem. The health page and `doctor.py` check the rest of the system.

---

## 21. Glossary: hard words made easy

| Word | Easy meaning |
|---|---|
| **AI model** | A computer program that learned a skill from examples |
| **Algorithm** | A step-by-step recipe a computer follows |
| **Annotation / label** | The correct answer drawn by a human (a box + a behaviour name) |
| **API** | The "doors" through which the website asks the server for things |
| **Augmentation** | Randomly changing training pictures to add variety |
| **Backend** | The server program that does the work behind the scenes |
| **Batch** | A group of pictures the model studies before updating itself |
| **Bounding box** | A rectangle drawn around an object in a picture |
| **Class** | A category the model can predict (our 5 behaviours) |
| **Class imbalance** | Some classes have far fewer examples than others (e.g. drinking) |
| **Confidence** | How sure the model is about a detection (0–100 %) |
| **Confusion matrix** | A table showing which classes the model mixes up |
| **COCO** | A large public dataset of everyday objects, used for pre-training |
| **CSV** | A simple table file that opens in Excel |
| **Database** | Organised storage of data (like Excel sheets the program can search) |
| **Data leakage** | When test data accidentally resembles training data, giving fake high scores |
| **Epoch** | One full pass through all training pictures |
| **Early stopping** | Stopping training when it stops improving |
| **F1 score** | A balance of precision and recall |
| **Fine-tuning** | Further training an already-trained model on a new task |
| **Frame** | One single picture from a video |
| **FPS (frames per second)** | How many pictures a video shows each second (smooth video is 25–30) |
| **Health check** | A web address that reports whether every part of the system is working |
| **Hungarian algorithm** | A classic method for pairing two lists in the best way (here: old cows with new boxes) |
| **Frontend** | The part of the website the user sees and clicks |
| **GPU** | A powerful graphics card that makes AI training much faster |
| **Hashing** | One-way scrambling (used for passwords) |
| **Inference** | Using a trained model to make predictions on new pictures |
| **IoU** | How much two boxes overlap (0 = not at all, 1 = perfectly) |
| **JWT** | A signed digital "ticket" that proves you are logged in |
| **Keyframe** | A frame chosen for labelling |
| **mAP** | The main accuracy score for object detection |
| **Neural network** | A large maths function with millions of adjustable numbers that learns from examples |
| **Object detection** | Finding *where* objects are and *what* they are |
| **Overfitting** | Memorising training examples instead of learning general rules |
| **Parameters / weights** | The adjustable numbers inside a neural network |
| **Precision** | When the model says X, how often it is right |
| **Pre-trained** | A model that has already learned from a big dataset |
| **Recall** | Of all real X, how many the model found |
| **Rumination** | A cow chewing the cud (bringing food back up and chewing it again), a sign of healthy digestion |
| **RTSP** | The standard way CCTV/IP cameras stream live video |
| **Snapshot** | The newest single picture from a camera (used on the camera cards) |
| **Tracking / track ID** | Following each cow from frame to frame and giving it a number (#1, #2, …) |
| **Test set** | Pictures kept hidden until the end, to measure real performance |
| **Thread / worker** | A separate helper inside the program that does a job in the background |
| **Training set** | Pictures the model learns from |
| **Validation set** | Pictures used during training to choose the best version |
| **WebSocket** | A browser–server connection that stays open, so the server can keep sending live video |
| **Workspace** | One farm/team inside the system, with its own members and data |
| **YOLO** | "You Only Look Once", a fast object-detection model family |

---

*Project files to show in a demo:* `Notebook/Notebook.ipynb` (training), `Notebook/model/best.pt` (trained model), `backend/` (server), `backend/app/services/tracker.py` (cow tracking), `backend/doctor.py` (setup checker), `frontend/` (website), `README.md` (technical specification), `Explain.md` (this file), `run.bat` (one-click start).
