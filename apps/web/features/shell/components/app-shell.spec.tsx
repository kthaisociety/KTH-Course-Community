import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const useSessionData = vi.fn();
const useMe = vi.fn();
const logout = vi.fn();
const setTheme = vi.fn();
const useThemeResult = vi.fn();

let pathname = "/search";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => useThemeResult(),
}));

// Only the session hooks are faked; AuthReasonDialog stays real so the rail's
// two buttons are checked against the dialog that actually opens.
vi.mock("@/features/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth")>()),
  useSessionData: () => useSessionData(),
  useMe: () => useMe(),
  useLogout: () => logout,
}));

function signedOut() {
  useSessionData.mockReturnValue({ user: null, isPending: false });
  useMe.mockReturnValue({ user: null, isLoading: false });
}

function signedIn(savedCourseCodes: string[] = []) {
  useSessionData.mockReturnValue({
    user: { name: "Elsa Lindqvist", email: "elsa@kth.se", image: null },
    isPending: false,
  });
  useMe.mockReturnValue({
    user: { userId: "u1", savedCourseCodes },
    isLoading: false,
  });
}

beforeEach(() => {
  pathname = "/search";
  useThemeResult.mockReturnValue({ resolvedTheme: "light", setTheme });
  signedOut();
});

function renderShell() {
  return render(
    <AppShell>
      <p>Page body</p>
    </AppShell>,
  );
}

/** The rail in the flow, not the copy of it inside an open drawer. */
function rail() {
  return screen.getAllByRole("navigation", { name: "Main" })[0];
}

function savedLink() {
  return within(rail()).getByRole("link", { name: /saved courses/i });
}

describe("AppShell", () => {
  it("renders the page it frames", () => {
    renderShell();
    expect(screen.getByText("Page body")).toBeInTheDocument();
  });

  describe("signed out", () => {
    it("still offers the whole catalogue — browsing needs no account", () => {
      renderShell();
      const nav = rail();
      expect(
        within(nav).getByRole("link", { name: /explore/i }),
      ).toHaveAttribute("href", "/search");
      expect(savedLink()).toHaveAttribute("href", "/favorites");
      expect(
        within(nav).getByRole("link", { name: /my page/i }),
      ).toHaveAttribute("href", "/profile");
    });

    it("says what an account adds rather than what it locks", () => {
      renderShell();
      expect(screen.getByText(/browsing as a guest/i)).toBeInTheDocument();
      expect(
        screen.getByText(/saving courses and posting reviews need an account/i),
      ).toBeInTheDocument();
    });

    // The artboard's guest copy elsewhere promises AI comparison; #68 settled
    // that no such feature exists, so it must not appear in the frame.
    it("promises nothing the app does not have", () => {
      renderShell();
      expect(screen.queryByText(/with ai/i)).not.toBeInTheDocument();
    });

    it.each([
      ["Sign up", /create your account/i],
      ["Log in", /log in to course community/i],
    ])("opens the sign-in dialog from %s", async (button, title) => {
      const user = userEvent.setup();
      renderShell();
      await user.click(screen.getByRole("button", { name: button }));
      await waitFor(() => expect(screen.getByText(title)).toBeInTheDocument());
    });

    it("asserts nothing while the session is still resolving", () => {
      useSessionData.mockReturnValue({ user: null, isPending: true });
      renderShell();
      expect(screen.queryByText(/browsing as a guest/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Sign up" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sign out/i }),
      ).not.toBeInTheDocument();
    });

    it("shows no saved count and no sign-out", () => {
      renderShell();
      expect(savedLink()).not.toHaveTextContent(/\d/);
      expect(
        screen.queryByRole("button", { name: /sign out/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("signed in", () => {
    it("names the account and offers a way out of it", async () => {
      const user = userEvent.setup();
      signedIn();
      renderShell();

      expect(screen.getByText("Elsa Lindqvist")).toBeInTheDocument();
      expect(screen.getByText("EL")).toBeInTheDocument();
      expect(
        screen.queryByText(/browsing as a guest/i),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /sign out/i }));
      expect(logout).toHaveBeenCalled();
    });

    it("counts the saved courses beside the link", () => {
      signedIn(["DD2380", "SF1626", "DD1337"]);
      renderShell();
      expect(savedLink()).toHaveTextContent("3");
    });

    it("drops the badge when nothing is saved", () => {
      signedIn([]);
      renderShell();
      expect(savedLink()).not.toHaveTextContent(/\d/);
    });

    it("falls back to the email when the account has no name", () => {
      useSessionData.mockReturnValue({
        user: { name: "", email: "nils@kth.se", image: null },
        isPending: false,
      });
      useMe.mockReturnValue({
        user: { userId: "u2", savedCourseCodes: [] },
        isLoading: false,
      });
      renderShell();
      expect(screen.getByText("nils")).toBeInTheDocument();
      expect(screen.getByText("N")).toBeInTheDocument();
    });
  });

  it("marks the page the visitor is on", () => {
    pathname = "/profile";
    renderShell();
    expect(
      within(rail()).getByRole("link", { name: /my page/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(rail()).getByRole("link", { name: /explore/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("counts a nested route as its section", () => {
    pathname = "/profile/settings";
    renderShell();
    expect(
      within(rail()).getByRole("link", { name: /my page/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  describe("the drawer", () => {
    it("brings the rail back on a narrow frame and closes after a tap", async () => {
      const user = userEvent.setup();
      renderShell();

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /open menu/i }));
      const drawer = await screen.findByRole("dialog");
      expect(
        within(drawer).getByRole("navigation", { name: "Main" }),
      ).toBeInTheDocument();

      await user.click(within(drawer).getByRole("link", { name: /explore/i }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    });

    it("closes from its own close button", async () => {
      const user = userEvent.setup();
      renderShell();
      await user.click(screen.getByRole("button", { name: /open menu/i }));
      await waitFor(() =>
        expect(screen.getByRole("dialog")).toBeInTheDocument(),
      );

      await user.click(screen.getByRole("button", { name: /close menu/i }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    });
  });

  describe("the theme toggle", () => {
    it("offers dark from light", async () => {
      const user = userEvent.setup();
      renderShell();
      await user.click(
        screen.getByRole("button", { name: /switch to dark mode/i }),
      );
      expect(setTheme).toHaveBeenCalledWith("dark");
    });

    it("offers light from dark", async () => {
      useThemeResult.mockReturnValue({ resolvedTheme: "dark", setTheme });
      const user = userEvent.setup();
      renderShell();
      await user.click(
        screen.getByRole("button", { name: /switch to light mode/i }),
      );
      expect(setTheme).toHaveBeenCalledWith("light");
    });
  });
});
