/**
 * OrderStatusTimeline – visual step tracker for an order's status.
 *
 * WooCommerce only exposes a single current `status` (no per-step history),
 * so the "دخل الطلب"/"processing"/"completed" dates shown are approximated
 * from `date_created`/`date_modified` rather than true per-step timestamps.
 * Cancelled/failed/refunded orders get a distinct terminal state instead of
 * being forced onto the normal progress line.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { OrderStatus } from '../../types';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { formatDate } from '../../utils/formatters';

const STEPS: { key: OrderStatus[]; label: string; icon: string }[] = [
  { key: ['pending', 'on-hold'], label: 'تم استلام الطلب', icon: 'clipboard-check-outline' },
  { key: ['processing'], label: 'قيد التجهيز', icon: 'package-variant' },
  { key: ['completed'], label: 'تم التسليم', icon: 'check-circle-outline' },
];

const TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'failed', 'refunded', 'trash'];

const TERMINAL_LABELS: Partial<Record<OrderStatus, string>> = {
  cancelled: 'تم إلغاء الطلب',
  failed: 'فشل الطلب',
  refunded: 'تم استرجاع الطلب',
  trash: 'تم حذف الطلب',
};

const getStepIndex = (status: OrderStatus): number => {
  const index = STEPS.findIndex((step) => step.key.includes(status));
  return index === -1 ? 0 : index;
};

export default function OrderStatusTimeline({
  status,
  dateCreated,
  dateModified,
}: {
  status: OrderStatus;
  dateCreated?: string;
  dateModified?: string;
}) {
  if (TERMINAL_STATUSES.includes(status)) {
    return (
      <View style={styles.terminalRow}>
        <MaterialCommunityIcons name="alert-circle-outline" style={styles.terminalIcon} />
        <View>
          <Text style={styles.terminalLabel}>{TERMINAL_LABELS[status] ?? 'حالة الطلب متوقفة'}</Text>
          {dateModified ? <Text style={styles.stepDate}>{formatDate(dateModified)}</Text> : null}
        </View>
      </View>
    );
  }

  const currentIndex = getStepIndex(status);

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isActive = isDone || isCurrent;
        const stepDate = index === 0 ? dateCreated : isCurrent ? dateModified : undefined;

        return (
          <View key={step.label} style={styles.stepRow}>
            <View style={styles.stepIndicatorColumn}>
              <View style={[styles.stepCircle, isActive && styles.stepCircleActive]}>
                <MaterialCommunityIcons
                  name={isDone ? 'check' : step.icon}
                  style={[styles.stepIcon, isActive && styles.stepIconActive]}
                />
              </View>
              {index < STEPS.length - 1 && (
                <View style={[styles.stepConnector, isDone && styles.stepConnectorActive]} />
              )}
            </View>
            <View style={styles.stepTextColumn}>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step.label}</Text>
              {stepDate ? <Text style={styles.stepDate}>{formatDate(stepDate)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: Spacing[2] },
  stepRow: { flexDirection: 'row-reverse', minHeight: 56 },
  stepIndicatorColumn: { alignItems: 'center', width: 36 },
  stepCircle: {
    width: 28, height: 28, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  stepIcon: { fontSize: 15, color: Colors.textTertiary },
  stepIconActive: { color: Colors.textInverse },
  stepConnector: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 2 },
  stepConnectorActive: { backgroundColor: Colors.success },
  stepTextColumn: { flex: 1, paddingRight: Spacing[3], paddingBottom: Spacing[4] },
  stepLabel: { ...Typography.labelLarge, color: Colors.textTertiary, textAlign: 'right', fontFamily: FontFamily.arabicMedium },
  stepLabelActive: { color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  stepDate: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'right', marginTop: 2 },

  terminalRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[2],
    backgroundColor: Colors.errorLight, borderRadius: BorderRadius.md, padding: Spacing[3],
  },
  terminalIcon: { fontSize: 22, color: Colors.error },
  terminalLabel: { ...Typography.labelLarge, color: Colors.error, fontFamily: FontFamily.arabicBold, textAlign: 'right' },
});
