import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

describe("Componentes UI Básicos", () => {
  describe("Button", () => {
    it("deve renderizar corretamente", () => {
      render(<Button>Test Button</Button>);
      expect(
        screen.getByRole("button", { name: /test button/i })
      ).toBeInTheDocument();
    });

    it("deve chamar onClick quando clicado", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Clickable</Button>);

      await user.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("deve estar desabilitado quando disabled é true", () => {
      render(<Button disabled>Disabled Button</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("deve aplicar variantes corretamente", () => {
      const { rerender } = render(
        <Button variant="destructive">Delete</Button>
      );
      expect(screen.getByRole("button")).toHaveClass("bg-destructive");

      rerender(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole("button")).toHaveClass("bg-secondary");
    });
  });

  describe("Input", () => {
    it("deve renderizar corretamente", () => {
      render(<Input placeholder="Test input" />);
      expect(screen.getByPlaceholderText("Test input")).toBeInTheDocument();
    });

    it("deve permitir digitação", async () => {
      const user = userEvent.setup();
      render(<Input placeholder="Type here" />);

      const input = screen.getByPlaceholderText("Type here");
      await user.type(input, "Hello world");

      expect(input).toHaveValue("Hello world");
    });

    it("deve estar desabilitado quando disabled é true", () => {
      render(<Input disabled placeholder="Disabled input" />);
      expect(screen.getByPlaceholderText("Disabled input")).toBeDisabled();
    });
  });

  describe("Card", () => {
    it("deve renderizar card completo", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Card content here</p>
          </CardContent>
        </Card>
      );

      expect(screen.getByText("Test Card")).toBeInTheDocument();
      expect(screen.getByText("Card content here")).toBeInTheDocument();
    });
  });
});
