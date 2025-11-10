export const cardDetailBadges: TrelloPowerUp.CapabilityHandler<
  [TrelloPowerUp.Client],
  TrelloPowerUp.CardDetailBadge[]
> = () => [
  {
    text: 'Live roster ready',
    color: 'blue',
    title: 'Card Agents streaming stub connected',
  },
];
