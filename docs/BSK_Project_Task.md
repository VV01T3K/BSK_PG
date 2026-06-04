# Security of Computer Systems – Project

**Bezpieczeństwo Systemów Komputerowych – Projekt**

### Emulating environment with Trusted Third Party and Client-Server data exchange scenario

_Piotr Rajchowski — Version 1.10, Gdańsk, 23.02.2026_

_Gdańsk University of Technology — Faculty of Electronics, Telecommunications and Informatics_

---

## 1. The goal and rules of project classes

The main goal of the project is to realize a set of applications for emulating an environment with a trusted third party (TTP), server and client. The goal is to demonstrate a real application scenario, including user authentication and service access.

The project is evaluated according to the following rules (**40 points in total**):

- Correct realization of the project before the deadline, presentation during submission – **20 points**
- Technical report – **15 points**
- Presentation of the initial stage of project realization (during control meeting) – **5 points** (all dates are published in the schedule)

The details of project evaluation are described in Section 3 and presented in Table 1.

> ⚠️ **Each student _must_ select the project group on the eNauczanie platform.** Skipping this step will result in assigning zero points from the control meeting.

---

## 2. Project tasks

The main goal of the project is to design and develop a set of applications emulating an environment with:

- a **User**,
- a **Server** that provides a service (e.g. web service, data transfer), and
- a **Trusted Third Party (TTP)** that authenticates the User and Server.

It is assumed that the communication will emulate a real scenario, so **at least two virtual machines (VM)** must be created (most suitably Server and TTP). The User's application can be executed from the physical computer.

### Fig. 1 – Block diagram of the emulated environment

```mermaid
flowchart TB
    subgraph PhysicalPC["🖥️ Physical PC"]
        VM1["VM 1 – Server"]
        VM2["VM 2 – TTP"]
        NET{{"Virtual local network"}}
        USER["Physical PC<br/>User"]

        VM1 <--> NET
        VM2 <--> NET
        USER <--> NET
    end

    style VM1 fill:#d6f0d6,stroke:#333
    style VM2 fill:#e8e8e8,stroke:#333
    style NET fill:#cfe8f5,stroke:#333
    style USER fill:#fbe0d0,stroke:#333
    style PhysicalPC fill:#ffffff,stroke:#333,stroke-dasharray: 5 5
```

---

### General usage scenario

Before any communication appears between User and Server, **each must register / login to the TTP**. User and Server generate their IDs and encrypt them with TTP's public key, then send them to TTP. Moreover, User and Server generate two pairs of RSA keys and send the public keys to the TTP. After this process each of them obtains from TTP its **X.509 public key certificate**.

When the User wants to use a service provided by the Server (e.g. web service, data transfer), it sends a request to the Server. The Server forwards the User's request to TTP and sends a request for Server authentication.

TTP validates the Server's request; after a positive decision it sends to Server and User the information that the Server was correctly authenticated. After that, TTP sends to User a request for User authentication. The User responds using its generated ID (and public key certificate) encrypted with TTP's public key.

TTP validates the response from User. If the validation is positive, it sends an OK response to User and Server, including the **session key** (encrypted with their public keys).

The User and Server are authenticated and have a valid session key, so the requested service can be started. From now on, the **encrypted data (using the session key)** are exchanged between User and Server. After finishing the process, the session is closed. The next service request repeats the authentication process.

> **Notes:**
>
> - The TTP public key can be sent to User / Server just after the login phase was initiated.
> - The public User's and Server's IDs must be generated using a **secure hash algorithm**.

---

### Fig. 2 – Data exchange between User, Server and TTP

```mermaid
sequenceDiagram
    participant U as User
    participant S as Server
    participant T as TTP

    Note over U,T: Registration / Login phase
    S->>T: Login
    U->>T: Login

    Note over U,T: Service request & authentication
    U->>S: Service request
    S->>T: User, Server auth.
    Note right of T: Validation
    T->>S: Server auth. OK
    S->>U: Server auth. OK
    T->>U: User Auth. redirect
    U->>T: User auth. data submit
    Note right of T: Validation
    T->>S: User Auth. OK + session key
    S->>U: User Auth. OK + session key

    Note over U,S: Authenticated session
    U->>S: Data exchange
    U->>S: End of session
```

---

## Key requirements

- It is advised to create the client's application with a **GUI interface** that allows selection of a service after initial authentication (or a web application).
- The **RSA algorithm with a 4096-bit key** must be used.
- A **pseudorandom generator** must be used to generate the session keys.
- For the session key, the **AES algorithm** should be used, with a **256-bit key**.
- **Status/message icons** presenting the state of the application (e.g. correct authentication, connection to server) must be implemented. Moreover, Server and TTP applications must **save their logs with timestamps**.
- It is assumed that only **one User** is expected; there is no need to demonstrate functionality for more users.
- It is allowed to use available libraries for the AES, RSA and SHA algorithms.
- The parameters of the cipher (algorithm type, key size, block size, cipher mode) can be set as **constants** in each application.
- Any programming language and technology platform can be used to develop the applications.
- In the report, a **brief description of performed tests** must be included (e.g. authentication validation, sample attacks/tests, encryption/decryption of transferred data, network connections).
- In the report, the **code of the application must be partially included as listings**, pointing out the main functions, with a short and substantive description.
- Full code documentation must be created using the **Doxygen** documentation generator.
- **Important:** It is obligatory to develop all projects (every step of development) using the University's GitLab repository (`https://git.pg.edu.pl`). The repository must be named using the pattern `[SCS_GN0000_Surname1_Surname2]`, where `GN0000` is the project group name (e.g. `MO1213`). When the project is created, the teacher must be invited as **"Maintainer"** to check the code during presentation and submission. It is strongly advised to modify the `.gitignore` file to prevent temporary compilation files from being committed.

---

## 3. Project submission and presentation rules

During the **control meeting**, each project group (presence is obligatory for all students in the group) shows current progress in project realization. Details are presented in Table 1.

During the **final submission**, each group (presence obligatory) presents the project realization, showing the application and implemented functionality. After the presentation, each group submits a report.

Dates for the control meeting and final project presentation are published on the eNauczanie platform.

Only **one submission date** is planned. In the case of obtaining an insufficient number of points for a positive mark, a **2nd submission date** is proposed — but in that case only **60% of the total points** can be obtained.

---

### Tab. 1 – Detailed project evaluation

#### Project submission — Presentation during classes

| #   | Task                                                                                                                                                                              | Points |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| 1   | Generation of public key certificates, session keys, correct user authentication (existence of three independent applications), implementation of application logs.               |   4    |
| 2   | Creation of a network environment with at least 2 virtual machines (e.g. TTP and Server).                                                                                         |   5    |
| 3   | Demonstration of correct implementation of the assumed project functionality (i.e. correct authentication of user–server with involved TTP, data transfer between client–server). |   5    |
| 4   | Presentation of correct and incorrect validation of authentication when the certificate was forged by an attacker (pointing out resistance to a man-in-the-middle attack).        |   6    |

#### Reports — Evaluated only after project presentation

**Partial report (control meeting) — 5 points** _(+ code, + presentation during classes)_

Minimal requirements:

- Presentation: e.g. possibility of certificate generation, authentication of two identities; basic version of client/server/TTP applications — **3 points**
- Code in University's GitLab repository shared with teacher — **2 points**
- Sending a 1-page description/report on eNauczanie is _not_ obligatory.

**Project report — 15 points** _(+ code, + University GIT repository, + bibliography)_

- Description of the realised task — **4 points**
- Description of key application functionality, pointing out code fragments as listings — **3 points**
- Code documentation using Doxygen — **3 points**
- Pointing out the bibliography — **2 points**
- Code in University's GitLab repository shared with teacher (no `*.zip` archive allowed) — **3 points**
