import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/material.css";
import { useEffect, useState } from "react";

const normalizePhoneValue = (phone) => {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return `+${raw.slice(1).replace(/\D/g, "")}`;

  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("66")) return `+${digits}`;
  return `+66${digits.replace(/^0/, "")}`;
};

/**
 * Shared international telephone input.
 *
 * Values are emitted in E.164-style form (for example, +66812345678).
 * Thailand is selected whenever a form does not already contain a country code.
 */
const CountryPhoneInput = ({
  value,
  defaultValue = "",
  onChange,
  onBlur,
  name,
  label = "Phone Number",
  placeholder = "Phone number",
  required = false,
  disabled = false,
  readOnly = false,
  error = false,
  helperText,
  fullWidth = true,
  className = "",
  inputProps = {},
  ...props
}) => {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => normalizePhoneValue(defaultValue));

  useEffect(() => {
    if (!isControlled) setInternalValue(normalizePhoneValue(defaultValue));
  }, [defaultValue, isControlled]);

  const handleChange = (digits, country, event, formattedValue) => {
    const numericValue = digits.replace(/^\+/, "");
    const normalizedValue = numericValue && numericValue !== country?.dialCode
      ? `+${numericValue}`
      : "";

    if (!isControlled) setInternalValue(normalizedValue);

    onChange?.({
      ...event,
      target: {
        ...event?.target,
        name,
        value: normalizedValue,
      },
      country,
      formattedValue,
    });
  };

  return (
    <div className={`${fullWidth ? "w-full" : ""} ${className}`.trim()}>
      <PhoneInput
        country="th"
        value={isControlled ? normalizePhoneValue(value) : internalValue}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        countryCodeEditable={false}
        enableSearch
        preferredCountries={["th"]}
        specialLabel={`${label}${required ? " *" : ""}`}
        placeholder={placeholder}
        inputProps={{
          ...inputProps,
          name,
          required,
          readOnly,
          autoComplete: inputProps.autoComplete || "tel",
        }}
        containerStyle={{ width: fullWidth ? "100%" : undefined }}
        inputStyle={{
          width: "100%",
          height: props.size === "small" ? 40 : 56,
          borderColor: error ? "#d32f2f" : undefined,
          backgroundColor: readOnly ? "rgba(0, 0, 0, 0.04)" : undefined,
        }}
        buttonStyle={{ borderColor: error ? "#d32f2f" : undefined }}
        {...props}
      />
      {helperText ? (
        <p
          className={`mx-3 mt-1 text-xs ${error ? "text-red-600" : "text-neutral-600"}`}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

export default CountryPhoneInput;
