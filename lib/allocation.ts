import { prisma } from "./prisma";

interface LeadData {
  customerName: string;
  phone: string;
  city: string;
  serviceId: number;
  description: string;
}

export async function allocateLead(leadData: LeadData) {
  return await prisma.$transaction(async (tx) => {
    // 1. Lock all provider rows for update to ensure concurrency-safe round-robin allocation
    // This blocks other transactions from executing allocation logic concurrently, preventing race conditions
    await tx.$queryRaw`SELECT id FROM "Provider" FOR UPDATE`;

    // 2. Look up the requested service
    const service = await tx.service.findUnique({
      where: { id: leadData.serviceId },
    });
    if (!service) {
      throw new Error(`Service with ID ${leadData.serviceId} not found.`);
    }

    // Hardcoded assignment rules based on Service names (highly resilient to ID changes)
    const serviceRules: Record<string, { mandatory: number[]; fairPool: number[] }> = {
      "Service 1": { mandatory: [1], fairPool: [2, 3, 4] },
      "Service 2": { mandatory: [5], fairPool: [6, 7, 8] },
      "Service 3": { mandatory: [1, 4], fairPool: [2, 3, 5, 6, 7, 8] },
    };

    const rule = serviceRules[service.name];
    if (!rule) {
      throw new Error(`No allocation rules defined for service name: ${service.name}`);
    }

    const assignedProviderIds: number[] = [];

    // Step 1: Assign mandatory providers
    const mandatoryProviders = await tx.provider.findMany({
      where: { id: { in: rule.mandatory } },
    });

    for (const provider of mandatoryProviders) {
      const remainingQuota = provider.monthlyQuota - provider.currentMonthLeads;
      if (remainingQuota > 0) {
        assignedProviderIds.push(provider.id);
        // Increment their current month leads count
        await tx.provider.update({
          where: { id: provider.id },
          data: { currentMonthLeads: { increment: 1 } },
        });
      }
    }

    // Step 2: Fill remaining slots up to exactly 3 total assignments
    const mandatoryCount = assignedProviderIds.length;
    const remainingSlots = 3 - mandatoryCount;

    if (remainingSlots > 0 && rule.fairPool.length > 0) {
      // Get remaining fair pool providers excluding any that were already assigned as mandatory
      const eligiblePoolIds = rule.fairPool.filter(id => !assignedProviderIds.includes(id));
      
      // Fetch details of eligible pool providers
      const eligibleProviders = await tx.provider.findMany({
        where: { id: { in: eligiblePoolIds } },
      });

      // Sort by allocationIndex ASC, then by id ASC to ensure deterministic round-robin tie-breaking
      const sortedPool = eligibleProviders.sort((a, b) => {
        if (a.allocationIndex !== b.allocationIndex) {
          return a.allocationIndex - b.allocationIndex;
        }
        return a.id - b.id;
      });

      let slotsFilled = 0;
      for (const provider of sortedPool) {
        if (slotsFilled >= remainingSlots) break;

        const remainingQuota = provider.monthlyQuota - provider.currentMonthLeads;
        if (remainingQuota > 0) {
          assignedProviderIds.push(provider.id);
          slotsFilled++;

          // Increment currentMonthLeads and increment allocationIndex by 1
          await tx.provider.update({
            where: { id: provider.id },
            data: {
              currentMonthLeads: { increment: 1 },
              allocationIndex: { increment: 1 },
            },
          });
        }
      }
    }

    // Step 3: Create Lead and assignments atomically in the database
    const lead = await tx.lead.create({
      data: {
        customerName: leadData.customerName,
        phone: leadData.phone,
        city: leadData.city,
        description: leadData.description,
        serviceId: leadData.serviceId,
      },
    });

    if (assignedProviderIds.length > 0) {
      await tx.leadAssignment.createMany({
        data: assignedProviderIds.map((providerId) => ({
          leadId: lead.id,
          providerId,
        })),
      });
    }

    // Fetch details of the assigned providers
    const assignedProviders = await tx.provider.findMany({
      where: { id: { in: assignedProviderIds } },
      select: { id: true, name: true },
    });

    return {
      leadId: lead.id,
      assignedProviders,
    };
  });
}
