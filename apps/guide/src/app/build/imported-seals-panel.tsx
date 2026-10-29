import { SealsDisplaySection } from '@/components/seals-display';

type Props = {
  sealNames: string[];
};

export function ImportedSealsPanel({ sealNames }: Props) {
  return <SealsDisplaySection sealNames={sealNames} variant="build" />;
}
