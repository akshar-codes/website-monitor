import apiClient from "./client";

export async function getAccountSettings() {
  const { data } = await apiClient.get("/account/settings");
  return data;
}

export async function updateAccountSettings(payload) {
  const { data } = await apiClient.patch("/account/settings", payload);
  return data;
}

export async function deleteAccount(confirmationEmail) {
  const { data } = await apiClient.delete("/account", {
    data: { confirmationEmail },
  });
  return data;
}
