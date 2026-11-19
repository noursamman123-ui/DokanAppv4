#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@interface AppVersion : NSObject <RCTBridgeModule>
@end

@implementation AppVersion

RCT_EXPORT_MODULE(AppVersion)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
  NSString *versionName = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  return versionName ? @{@"versionName": versionName} : @{};
}

@end
