export const authorizationStatus: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], Promise<
  TrelloPowerUp.AuthorizationStatus
>> = async () => ({
  authorized: true,
  validity: null,
});

export const showAuthorization: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], Promise<void>> = async (t) => {
  await t.alert({ message: 'Future implementation: prompt for OpenShift credentials.' });
};
